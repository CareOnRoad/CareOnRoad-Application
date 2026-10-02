import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AdminServiceRequestService } from "@/features/admin/admin-service-request.service";
import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const timeout = 30_000;
const now = new Date("2026-07-06T06:00:00.000Z");
const reason = { reason: "PostgreSQL request recovery verification" };

describeDatabase("admin service-request PostgreSQL integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  const authUserIds: string[] = [];
  let adminId: string;
  let riderId: string;
  let mechanicId: string;
  let requestSequence = 0;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, {
      maxConnections: 8
    });
    sql = context.sql;
    await applyAllMigrations(sql);
  }, timeout);

  beforeEach(async () => {
    adminId = randomUUID();
    riderId = randomUUID();
    mechanicId = randomUUID();
    authUserIds.push(adminId, riderId, mechanicId);
    await seedActor(adminId, "admin");
    await seedActor(riderId, "rider");
    await seedActor(mechanicId, "mechanic");
    await sql`
      insert into mechanic_profiles (
        user_id, profile_status, is_available, service_radius_km,
        availability_updated_at, rating_avg, rating_count, created_at, updated_at
      )
      values (
        ${mechanicId}, 'active', true, 10, ${now}, 0, 0, ${now}, ${now}
      )
    `;
    await sql`
      insert into mechanic_skills (mechanic_id, service_type)
      values (${mechanicId}, 'mobile_repair')
    `;
  }, timeout);

  afterAll(async () => {
    if (sql && context) {
      await sql.unsafe(`drop schema if exists "${context.schema}" cascade`);
      if (authUserIds.length > 0) {
        await sql`delete from auth.users where id = any(${authUserIds})`;
      }
    }
    await context?.dispose();
  }, timeout);

  it(
    "locks and reconciles request, round, and open offers in one transaction",
    async () => {
      const fixture = await seedRequestWithActiveDispatch();
      const service = createService();
      await expect(
        service.cancel(
          identity(adminId),
          fixture.requestId,
          reason,
          "postgres-request-cancel"
        )
      ).resolves.toMatchObject({
        id: fixture.requestId,
        status: "canceled",
        dispatch: { status: "canceled", open_candidate_count: 0 }
      });

      const [requestRows, roundRows, candidateRows, historyRows] =
        await Promise.all([
          sql`select status from service_requests where id = ${fixture.requestId}`,
          sql`select status from dispatch_rounds where id = ${fixture.roundId}`,
          sql`select status from dispatch_candidates where id = ${fixture.candidateId}`,
          sql`
            select from_status, to_status
            from request_status_history
            where request_id = ${fixture.requestId}
            order by created_at desc, id desc
          `
        ]);
      expect(requestRows).toEqual([{ status: "canceled" }]);
      expect(roundRows).toEqual([{ status: "canceled" }]);
      expect(candidateRows).toEqual([{ status: "cancelled" }]);
      expect(historyRows[0]).toEqual({
        from_status: "offered",
        to_status: "canceled"
      });
    },
    timeout
  );

  it(
    "serializes cancel versus escalation, allowing cancellation after escalation",
    async () => {
      const fixture = await seedRequestWithActiveDispatch();
      const results = await Promise.allSettled([
        createService().cancel(
          identity(adminId),
          fixture.requestId,
          reason,
          "postgres-race-cancel"
        ),
        createService().manualEscalate(
          identity(adminId),
          fixture.requestId,
          reason,
          "postgres-race-escalate"
        )
      ]);
      expect(results[0].status).toBe("fulfilled");
      const rows = await sql<{ status: string }[]>`
        select status::text from service_requests where id = ${fixture.requestId}
      `;
      expect(rows[0]?.status).toBe("canceled");
      const history = await sql`select from_status, to_status from request_status_history where request_id = ${fixture.requestId} order by created_at, id`;
      expect(history.filter((row) => row.to_status === 'canceled')).toHaveLength(1);
      if (results[1].status === "fulfilled") expect(history).toEqual(expect.arrayContaining([
        expect.objectContaining({ from_status: "offered", to_status: "manual_escalation" }),
        expect.objectContaining({ from_status: "manual_escalation", to_status: "canceled" })
      ]));
      await expect(
        sql`select status from dispatch_rounds where id = ${fixture.roundId}`
      ).resolves.toEqual([{ status: "canceled" }]);
      await expect(
        sql`select status from dispatch_candidates where id = ${fixture.candidateId}`
      ).resolves.toEqual([{ status: "cancelled" }]);
    },
    timeout
  );

  it(
    "keeps private notes isolated and rolls all command writes back on outbox failure",
    async () => {
      const noteFixture = await seedRequestWithActiveDispatch();
      const noteText = "Private database-only operations note";
      await createService().addNote(
        identity(adminId),
        noteFixture.requestId,
        { ...reason, note: noteText },
        "postgres-request-note"
      );
      const [noteRows, auditRows, outboxRows] = await Promise.all([
        sql`select note_text from admin_internal_notes where service_request_id = ${noteFixture.requestId}`,
        sql`select metadata::text from audit_logs where entity_id = ${noteFixture.requestId}`,
        sql`select payload::text from outbox_events where aggregate_id = ${noteFixture.requestId}`
      ]);
      expect(noteRows).toEqual([{ note_text: noteText }]);
      expect(JSON.stringify(auditRows)).not.toContain(noteText);
      expect(JSON.stringify(outboxRows)).not.toContain(noteText);

      const rollbackFixture = await seedRequestWithActiveDispatch();
      const idempotencyId = randomUUID();
      const historyId = randomUUID();
      const occurrenceId = randomUUID();
      const auditId = randomUUID();
      await sql`
        insert into outbox_events (
          id, topic, aggregate_type, aggregate_id, dedupe_key, payload
        )
        values (
          ${randomUUID()}, 'admin.service_request.canceled', 'service_request',
          ${rollbackFixture.requestId},
          ${`admin.service_request.canceled:${rollbackFixture.requestId}:${occurrenceId}`},
          '{}'::jsonb
        )
      `;
      const identifiers = [idempotencyId, historyId, occurrenceId, auditId];
      const rollbackService = new AdminServiceRequestService(
        new PostgresUnitOfWork(sql),
        { now: () => now, createId: () => identifiers.shift()! }
      );
      await expect(
        rollbackService.cancel(
          identity(adminId),
          rollbackFixture.requestId,
          reason,
          "postgres-request-rollback"
        )
      ).rejects.toThrow();

      const [requestRows, roundRows, candidateRows, newHistory, idempotencyRows] =
        await Promise.all([
          sql`select status from service_requests where id = ${rollbackFixture.requestId}`,
          sql`select status from dispatch_rounds where id = ${rollbackFixture.roundId}`,
          sql`select status from dispatch_candidates where id = ${rollbackFixture.candidateId}`,
          sql`select id from request_status_history where id = ${historyId}`,
          sql`select id from idempotency_records where id = ${idempotencyId}`
        ]);
      expect(requestRows).toEqual([{ status: "offered" }]);
      expect(roundRows).toEqual([{ status: "active" }]);
      expect(candidateRows).toEqual([{ status: "offered" }]);
      expect(newHistory).toHaveLength(0);
      expect(idempotencyRows).toHaveLength(0);
    },
    timeout
  );

  function createService() {
    return new AdminServiceRequestService(new PostgresUnitOfWork(sql), {
      now: () => now
    });
  }

  async function seedActor(
    id: string,
    role: "admin" | "rider" | "mechanic"
  ) {
    await sql`
      insert into auth.users (id, created_at, updated_at)
      values (${id}, now(), now())
    `;
    await sql`
      insert into app_users (id, status, created_at, updated_at)
      values (${id}, 'active', ${now}, ${now})
    `;
    await sql`insert into user_roles (user_id, role) values (${id}, ${role})`;
  }

  async function seedRequestWithActiveDispatch() {
    requestSequence += 1;
    const motorcycleId = randomUUID();
    const requestId = randomUUID();
    const roundId = randomUUID();
    const candidateId = randomUUID();
    await sql`
      insert into motorcycles (
        id, rider_id, brand_text, model_text, created_at, updated_at
      )
      values (${motorcycleId}, ${riderId}, 'Honda', 'Wave', ${now}, ${now})
    `;
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type,
        service_location, problem_description, status, priority, address_text, created_at, updated_at
      )
      values (
        ${requestId}, ${`COR-MOB-20260706-${requestSequence}`},
        ${riderId}, ${motorcycleId}, 'mobile_repair', ST_SetSRID(ST_MakePoint(106.69, 10.77), 4326)::geography, 'Private integration text',
        'offered', 'high', 'Private integration address', ${now}, ${now}
      )
    `;
    await sql`
      insert into dispatch_rounds (
        id, request_id, round_number, radius_m, status, started_at, expires_at
      )
      values (
        ${roundId}, ${requestId}, 1, 2000, 'active',
        ${new Date(now.getTime() - 60_000)}, ${new Date(now.getTime() + 60_000)}
      )
    `;
    await sql`
      insert into dispatch_candidates (
        id, round_id, request_id, mechanic_id, rank, distance_m, status,
        offered_at, expires_at, created_at
      )
      values (
        ${candidateId}, ${roundId}, ${requestId}, ${mechanicId}, 1, 500,
        'offered', ${new Date(now.getTime() - 60_000)},
        ${new Date(now.getTime() + 60_000)}, ${new Date(now.getTime() - 60_000)}
      )
    `;
    return { requestId, roundId, candidateId };
  }
});

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://careonroad.test/auth/v1",
    audience: ["authenticated"]
  };
}

async function applyAllMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  const migrationDirectory = resolve(process.cwd(), "..", "..", "supabase", "migrations");
  for (const migrationFile of readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await sql.unsafe(readFileSync(resolve(migrationDirectory, migrationFile), "utf8"));
  }
}
