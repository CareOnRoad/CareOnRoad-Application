import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AssignmentRecoveryService } from "@/features/assignments/assignment-recovery.service";
import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

describeDatabase("assignment recovery repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let mechanicId: string;
  let adminId: string;
  let assignmentId: string;
  let requestId: string;
  const now = new Date("2026-08-23T04:00:00.000Z");

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 10 });
    sql = context.sql;
    for (const migrationFile of migrationFiles) {
      await sql.unsafe(readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8"));
    }
    riderId = randomUUID();
    mechanicId = randomUUID();
    adminId = randomUUID();
    for (const [id, role] of [[riderId, "rider"], [mechanicId, "mechanic"], [adminId, "admin"]] as const) {
      await sql`insert into auth.users (id, created_at, updated_at) values (${id}, now(), now())`;
      await sql`insert into app_users (id, status) values (${id}, 'active')`;
      await sql`insert into user_roles (user_id, role) values (${id}, ${role})`;
    }
    await sql`
      insert into mechanic_profiles (
        user_id, profile_status, is_available, service_radius_km,
        availability_updated_at, rating_avg, rating_count
      ) values (${mechanicId}, 'active', true, 10, ${now}, 0, 0)
    `;
    const motorcycleId = randomUUID();
    requestId = randomUUID();
    const roundId = randomUUID();
    const candidateId = randomUUID();
    assignmentId = randomUUID();
    await sql`insert into motorcycles (id, rider_id, brand_text, model_text) values (${motorcycleId}, ${riderId}, 'Honda', 'Wave')`;
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type,
        problem_description, address_text, status, priority, created_at, updated_at
      ) values (
        ${requestId}, 'COR-MOB-20260823-901', ${riderId}, ${motorcycleId},
        'mobile_repair', 'private', '1 Nguyen Trai', 'assigned', 'normal', ${now}, ${now}
      )
    `;
    await sql`
      insert into dispatch_rounds (id, request_id, round_number, radius_m, status, started_at, expires_at, completed_at)
      values (${roundId}, ${requestId}, 1, 2000, 'accepted', ${now}, ${new Date(now.getTime() + 60_000)}, ${now})
    `;
    await sql`
      insert into dispatch_candidates (
        id, round_id, request_id, mechanic_id, rank, status, offered_at, expires_at, responded_at, created_at
      ) values (
        ${candidateId}, ${roundId}, ${requestId}, ${mechanicId}, 1, 'accepted',
        ${now}, ${new Date(now.getTime() + 60_000)}, ${now}, ${now}
      )
    `;
    await sql`
      insert into assignments (
        id, request_id, mechanic_id, accepted_candidate_id, status, accepted_at, created_at, updated_at
      ) values (${assignmentId}, ${requestId}, ${mechanicId}, ${candidateId}, 'accepted', ${now}, ${now}, ${now})
    `;
  }, 120_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: [riderId, mechanicId, adminId].filter(Boolean) });
  }, 30_000);

  it("serializes competing recovery commands and releases active uniqueness", async () => {
    const service = new AssignmentRecoveryService(new PostgresUnitOfWork(sql), { now: () => now });
    const identity = { subject: adminId, issuer: "test", audience: ["authenticated"] };
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) =>
      service.recover(identity, assignmentId, { reason_code: "no_show" }, `postgres-recovery-${index}`)
    ));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [assignments, requests, events] = await Promise.all([
      sql`select status, canceled_at from assignments where id = ${assignmentId}`,
      sql`select status from service_requests where id = ${requestId}`,
      sql`select topic, payload from outbox_events where topic = 'assignment.recovery.requested'`
    ]);
    expect(assignments).toMatchObject([{ status: "recovery_canceled" }]);
    expect(requests).toMatchObject([{ status: "submitted" }]);
    expect(events).toHaveLength(1);
  }, 90_000);
});
