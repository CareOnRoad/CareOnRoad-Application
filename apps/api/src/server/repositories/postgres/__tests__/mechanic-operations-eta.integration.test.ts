import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupPostgresTables,
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

describeDatabase("mechanic operations ETA repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let mechanicId: string;
  let assignmentId: string;
  let requestId: string;
  let now: Date;
  const authUserIds = new Set<string>();

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 5 });
    sql = context.sql;
    for (const migrationFile of migrationFiles) {
      await sql.unsafe(
        readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
      );
    }
  }, 30_000);

  beforeEach(async () => {
    now = new Date("2026-07-07T08:00:00.000Z");
    riderId = randomUUID();
    mechanicId = randomUUID();
    requestId = randomUUID();
    assignmentId = randomUUID();
    await sql.unsafe(
      "alter table admin_internal_notes disable trigger admin_internal_notes_reject_truncate"
    );
    try {
      await cleanupPostgresTables(
        sql,
        [
          "assignment_eta_metadata",
          "assignment_status_history",
          "assignments",
          "dispatch_candidates",
          "dispatch_rounds",
          "request_status_history",
          "service_requests",
          "daily_request_sequences",
          "motorcycles",
          "mechanic_skills",
          "mechanic_profiles",
          "user_devices",
          "user_roles",
          "app_users",
          "audit_logs",
          "outbox_events",
          "idempotency_records"
        ],
        { resetAppendOnlyAuditLogs: true }
      );
    } finally {
      await sql.unsafe(
        "alter table admin_internal_notes enable trigger admin_internal_notes_reject_truncate"
      );
    }
    await seedFixture();
  }, 30_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: [...authUserIds] });
  }, 30_000);

  it("locks an owned assignment and appends immutable ETA metadata", async () => {
    await new PostgresUnitOfWork(sql).execute(async ({ mechanicOperations }) => {
      const assignment = await mechanicOperations.findOwnedAssignmentForUpdate({
        assignmentId,
        mechanicId
      });
      expect(assignment).toMatchObject({ id: assignmentId, mechanicId });
      const metadata = await mechanicOperations.createAssignmentEtaMetadata({
        id: randomUUID(),
        assignmentId,
        requestId,
        mechanicId,
        etaAt: new Date(now.getTime() + 10 * 60_000),
        delayReason: "Bounded delay reason",
        createdBy: mechanicId,
        createdAt: now
      });
      expect(metadata).toMatchObject({ assignmentId, mechanicId });
    });

    await new PostgresUnitOfWork(sql).execute(async ({ mechanicOperations }) => {
      await expect(mechanicOperations.listAssignmentEtaMetadata(assignmentId)).resolves.toHaveLength(
        1
      );
    });
  }, 30_000);

  it("rolls back ETA metadata writes with the surrounding transaction", async () => {
    await expect(
      new PostgresUnitOfWork(sql).execute(async ({ mechanicOperations }) => {
        await mechanicOperations.createAssignmentEtaMetadata({
          id: randomUUID(),
          assignmentId,
          requestId,
          mechanicId,
          etaAt: new Date(now.getTime() + 10 * 60_000),
          createdBy: mechanicId,
          createdAt: now
        });
        throw new Error("force rollback");
      })
    ).rejects.toThrow("force rollback");

    await expect(
      sql`select count(*)::int as count from assignment_eta_metadata where assignment_id = ${assignmentId}`
    ).resolves.toEqual([{ count: 0 }]);
  }, 30_000);

  async function seedFixture() {
    const motorcycleId = randomUUID();
    const roundId = randomUUID();
    const candidateId = randomUUID();
    await seedAuthUser(riderId);
    await seedAuthUser(mechanicId);
    await sql`insert into app_users (id, status, created_at, updated_at) values (${riderId}, 'active', ${now}, ${now})`;
    await sql`insert into app_users (id, status, created_at, updated_at) values (${mechanicId}, 'active', ${now}, ${now})`;
    await sql`insert into user_roles (user_id, role) values (${riderId}, 'rider')`;
    await sql`insert into user_roles (user_id, role) values (${mechanicId}, 'mechanic')`;
    await sql`
      insert into motorcycles (id, rider_id, brand_text, model_text, created_at, updated_at)
      values (${motorcycleId}, ${riderId}, 'Honda', 'Wave', ${now}, ${now})
    `;
    await sql`
      insert into mechanic_profiles (
        user_id, profile_status, is_available, service_radius_km, created_at, updated_at
      )
      values (${mechanicId}, 'active', true, 20, ${now}, ${now})
    `;
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type, problem_description,
        status, priority, service_location, created_at, updated_at
      )
      values (
        ${requestId}, 'COR-MOB-20260707-1', ${riderId}, ${motorcycleId},
        'mobile_repair', 'Private text', 'assigned', 'normal',
        ST_SetSRID(ST_MakePoint(106.660172, 10.762622), 4326)::geography,
        ${now}, ${now}
      )
    `;
    await sql`
      insert into dispatch_rounds (
        id, request_id, round_number, radius_m, status, started_at, expires_at
      )
      values (${roundId}, ${requestId}, 1, 2000, 'active', ${now}, ${new Date(now.getTime() + 60_000)})
    `;
    await sql`
      insert into dispatch_candidates (
        id, round_id, request_id, mechanic_id, rank, distance_m, status,
        offered_at, expires_at, responded_at, created_at
      )
      values (
        ${candidateId}, ${roundId}, ${requestId}, ${mechanicId}, 1, 20, 'accepted',
        ${now}, ${new Date(now.getTime() + 60_000)}, ${now}, ${now}
      )
    `;
    await sql`
      insert into assignments (
        id, request_id, mechanic_id, accepted_candidate_id, status,
        accepted_at, created_at, updated_at
      )
      values (${assignmentId}, ${requestId}, ${mechanicId}, ${candidateId}, 'accepted', ${now}, ${now}, ${now})
    `;
  }

  async function seedAuthUser(id: string) {
    authUserIds.add(id);
    await sql`insert into auth.users (id, created_at, updated_at) values (${id}, ${now}, ${now})`;
  }
});
