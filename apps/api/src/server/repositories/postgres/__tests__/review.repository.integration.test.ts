import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ReviewService } from "@/features/reviews/review.service";
import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";
import { ReviewRatingRebuildWorker } from "@/server/workers/review-rating-rebuild.worker";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

describeDatabase("review repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let mechanicId: string;
  let zeroReviewMechanicId: string;
  let assignmentIds: string[];
  const now = new Date("2026-08-23T09:00:00.000Z");

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 10 });
    sql = context.sql;
    for (const migrationFile of migrationFiles) {
      await sql.unsafe(readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8"));
    }
    riderId = randomUUID();
    mechanicId = randomUUID();
    zeroReviewMechanicId = randomUUID();
    for (const [id, role] of [
      [riderId, "rider"],
      [mechanicId, "mechanic"],
      [zeroReviewMechanicId, "mechanic"]
    ] as const) {
      await sql`insert into auth.users (id, created_at, updated_at) values (${id}, now(), now())`;
      await sql`insert into app_users (id, status) values (${id}, 'active')`;
      await sql`insert into user_roles (user_id, role) values (${id}, ${role})`;
      if (role === "mechanic") {
        await sql`
          insert into mechanic_profiles (
            user_id, profile_status, is_available, service_radius_km,
            availability_updated_at, rating_avg, rating_count
          ) values (${id}, 'active', false, 10, ${now}, 4.99, 99)
        `;
      }
    }
    const motorcycleId = randomUUID();
    await sql`
      insert into motorcycles (id, rider_id, brand_text, model_text)
      values (${motorcycleId}, ${riderId}, 'Honda', 'Wave')
    `;
    assignmentIds = [];
    for (let index = 1; index <= 3; index += 1) {
      assignmentIds.push(await seedCompletedJob(sql, { riderId, mechanicId, motorcycleId, index, now }));
    }
  }, 120_000);

  afterAll(async () => {
    await context?.dispose({
      authUserIds: [riderId, mechanicId, zeroReviewMechanicId].filter(Boolean)
    });
  }, 30_000);

  it("deduplicates concurrent reviews, rounds aggregates, enforces immutability, and rebuilds all", async () => {
    const unitOfWork = new PostgresUnitOfWork(sql);
    const service = new ReviewService(unitOfWork, { now: () => now });
    const identity = { subject: riderId, issuer: "issuer", audience: ["authenticated"] };
    const concurrent = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        service.createReview(
          identity,
          assignmentIds[0]!,
          { rating: 5, comment: "Private rider comment" },
          `postgres-review-${index}`
        )
      )
    );
    expect(new Set(concurrent.map((result) => result.id)).size).toBe(1);
    await sql`update mechanic_profiles set is_available = false, profile_status = 'suspended' where user_id = ${mechanicId}`;
    await sql`delete from user_roles where user_id = ${mechanicId} and role = 'mechanic'`;
    await service.createReview(identity, assignmentIds[1]!, { rating: 4 }, "postgres-review-9");
    const final = await service.createReview(identity, assignmentIds[2]!, { rating: 4 }, "postgres-review-10");
    expect(final.mechanic_rating).toEqual({ average: 4.33, count: 3 });

    const [reviews, auditRows, outboxRows] = await Promise.all([
      sql`select id, rating from service_reviews where mechanic_id = ${mechanicId}`,
      sql`select metadata from audit_logs where action = 'review.created'`,
      sql`select payload from outbox_events where topic = 'review.created'`
    ]);
    expect(reviews).toHaveLength(3);
    expect(auditRows).toHaveLength(3);
    expect(outboxRows).toHaveLength(3);
    expect(JSON.stringify([...auditRows, ...outboxRows])).not.toMatch(/Private rider comment|rider_id/);

    await expect(
      sql`update service_reviews set rating = 1 where id = ${concurrent[0]!.id}`
    ).rejects.toBeDefined();
    await sql`update mechanic_profiles set rating_avg = 1, rating_count = 999`;
    await expect(new ReviewRatingRebuildWorker(unitOfWork, { now: () => now }).rebuild()).resolves.toEqual({
      mechanics_rebuilt: 2
    });
    const profiles = await sql<{ user_id: string; rating_avg: string; rating_count: number }[]>`
      select user_id, rating_avg::text, rating_count
      from mechanic_profiles
      order by user_id
    `;
    expect(profiles).toEqual(expect.arrayContaining([
      { user_id: mechanicId, rating_avg: "4.33", rating_count: 3 },
      { user_id: zeroReviewMechanicId, rating_avg: "0.00", rating_count: 0 }
    ]));
  }, 90_000);
});

async function seedCompletedJob(
  sql: Sql,
  input: { riderId: string; mechanicId: string; motorcycleId: string; index: number; now: Date }
): Promise<string> {
  const requestId = randomUUID();
  const roundId = randomUUID();
  const candidateId = randomUUID();
  const assignmentId = randomUUID();
  await sql`
    insert into service_requests (
      id, request_code, rider_id, motorcycle_id, service_type,
      service_location, problem_description, address_text, status, priority, created_at, updated_at
    ) values (
      ${requestId}, ${`COR-MOB-20260823-${input.index}`}, ${input.riderId},
      ${input.motorcycleId}, 'mobile_repair', ST_SetSRID(ST_MakePoint(106.69, 10.77), 4326)::geography, 'Xe can sua', '1 Nguyen Trai',
      'completed', 'normal', ${input.now}, ${input.now}
    )
  `;
  await sql`
    insert into dispatch_rounds (
      id, request_id, round_number, radius_m, status, started_at, expires_at
    ) values (
      ${roundId}, ${requestId}, 1, 2000, 'accepted', ${input.now},
      ${new Date(input.now.getTime() + 60_000)}
    )
  `;
  await sql`
    insert into dispatch_candidates (
      id, round_id, request_id, mechanic_id, rank, distance_m, status,
      offered_at, expires_at, responded_at, created_at
    ) values (
      ${candidateId}, ${roundId}, ${requestId}, ${input.mechanicId}, 1, 20,
      'accepted', ${input.now}, ${new Date(input.now.getTime() + 60_000)},
      ${input.now}, ${input.now}
    )
  `;
  await sql`
    insert into assignments (
      id, request_id, mechanic_id, accepted_candidate_id, status,
      accepted_at, completed_at, created_at, updated_at
    ) values (
      ${assignmentId}, ${requestId}, ${input.mechanicId}, ${candidateId},
      'completed', ${input.now}, ${input.now}, ${input.now}, ${input.now}
    )
  `;
  return assignmentId;
}
