import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = readdirSync(resolve(process.cwd(), "../../supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

describeDatabase("live tracking repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let mechanicId: string;
  let assignmentId: string;
  const now = new Date("2026-08-23T07:00:00.000Z");

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 5 });
    sql = context.sql;
    for (const migrationFile of migrationFiles) {
      await sql.unsafe(readFileSync(resolve(process.cwd(), "../../supabase/migrations", migrationFile), "utf8"));
    }
    riderId = randomUUID();
    mechanicId = randomUUID();
    for (const [id, role] of [[riderId, "rider"], [mechanicId, "mechanic"]] as const) {
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
    const requestId = randomUUID();
    const roundId = randomUUID();
    const candidateId = randomUUID();
    assignmentId = randomUUID();
    await sql`insert into motorcycles (id, rider_id, brand_text, model_text) values (${motorcycleId}, ${riderId}, 'Honda', 'Wave')`;
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type,
        problem_description, address_text, status, priority, created_at, updated_at
      ) values (
        ${requestId}, 'COR-MOB-20260823-932', ${riderId}, ${motorcycleId},
        'mobile_repair', 'private', 'private', 'assigned', 'normal', ${now}, ${now}
      )
    `;
    await sql`
      insert into dispatch_rounds (id, request_id, round_number, radius_m, status, started_at, expires_at, completed_at)
      values (${roundId}, ${requestId}, 1, 2000, 'accepted', ${now}, ${new Date(now.getTime() + 60_000)}, ${now})
    `;
    await sql`
      insert into dispatch_candidates (
        id, round_id, request_id, mechanic_id, rank, status,
        offered_at, expires_at, responded_at, created_at
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
    await context?.dispose({ authUserIds: [riderId, mechanicId].filter(Boolean) });
  }, 30_000);

  it("overwrites latest, hides expiry, trigger-deletes, and cleans bounded rows", async () => {
    const unitOfWork = new PostgresUnitOfWork(sql);
    const base = {
      assignmentId,
      mechanicId,
      longitude: 106.7,
      accuracyMeters: 10,
      receivedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now
    };
    await expect(unitOfWork.execute(({ liveTracking }) => liveTracking.upsert({
      ...base,
      latitude: 10.77,
      observedAt: new Date(now.getTime() - 5_000)
    }))).resolves.toMatchObject({ created: true });
    await expect(unitOfWork.execute(({ liveTracking }) => liveTracking.upsert({
      ...base,
      latitude: 10.78,
      observedAt: now,
      receivedAt: new Date(now.getTime() + 5_000),
      updatedAt: new Date(now.getTime() + 5_000)
    }))).resolves.toMatchObject({ created: false, location: { latitude: 10.78 } });
    await expect(unitOfWork.execute(({ liveTracking }) =>
      liveTracking.findCurrentByAssignmentId(assignmentId, new Date(now.getTime() + 61_000))
    )).resolves.toBeUndefined();

    await sql`update assignments set status = 'on_site' where id = ${assignmentId}`;
    await expect(sql`select assignment_id from assignment_live_locations where assignment_id = ${assignmentId}`)
      .resolves.toHaveLength(0);

    await sql`update assignments set status = 'accepted' where id = ${assignmentId}`;
    await unitOfWork.execute(({ liveTracking }) => liveTracking.upsert({
      ...base,
      latitude: 10.79,
      observedAt: new Date(now.getTime() - 20_000),
      receivedAt: new Date(now.getTime() - 10_000),
      expiresAt: new Date(now.getTime() - 1_000),
      createdAt: new Date(now.getTime() - 10_000),
      updatedAt: new Date(now.getTime() - 10_000)
    }));
    await expect(unitOfWork.execute(({ liveTracking }) => liveTracking.deleteExpired(now, 1)))
      .resolves.toBe(1);
    await expect(unitOfWork.execute(({ liveTracking }) => liveTracking.deleteExpired(now, 1)))
      .resolves.toBe(0);
  }, 90_000);

  it("denies direct authenticated table privileges", async () => {
    const rows = await sql<{ canSelect: boolean; canInsert: boolean }[]>`
      select
        has_table_privilege('authenticated', 'assignment_live_locations', 'select') as "canSelect",
        has_table_privilege('authenticated', 'assignment_live_locations', 'insert') as "canInsert"
    `;
    expect(rows[0]).toEqual({ canSelect: false, canInsert: false });
  });
});
