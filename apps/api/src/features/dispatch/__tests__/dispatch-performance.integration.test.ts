import { readFileSync, readdirSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AcceptAssignmentService } from "@/features/assignments/accept-assignment.service";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase
} from "@/server/testing/postgres-test-context";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const now = new Date("2026-06-30T05:00:00.000Z");
const HOSTED_OPERATION_THRESHOLD_MS = 60_000;
const riderId = uuid(900);
const motorcycleId = uuid(901);
const mechanicIds = Array.from({ length: 50 }, (_, index) => uuid(index + 1));

describeDatabase("dispatch local regression smoke", () => {
  it("handles pilot fixtures and five contested accepts within generous local thresholds", async () => {
    const context = await createIsolatedPostgresTestContext(process.env, {
      maxConnections: 16
    });
    const sql = context.sql;
    const authUserIds = [riderId, ...mechanicIds];

    try {
      await applyMigrations(sql);
      await seedIdentityFixtures(sql);
      const activeMechanics = new Set(mechanicIds.slice(0, 10));
      await seedTenActiveAssignments(sql, activeMechanics);

      const targetRequestId = uuid(902);
      await seedRequest(sql, {
        id: targetRequestId,
        sequence: 100,
        status: "submitted"
      });
      const dispatch = new DispatchService(new PostgresUnitOfWork(sql), {
        now: () => now
      });

      const candidateStartedAt = performance.now();
      const round = await dispatch.startDispatch(identity(riderId), targetRequestId);
      const candidateElapsedMs = performance.now() - candidateStartedAt;

      expect(candidateElapsedMs).toBeLessThan(HOSTED_OPERATION_THRESHOLD_MS);
      expect(round.candidates).toHaveLength(10);
      expect(round.candidates.every((candidate) => !activeMechanics.has(candidate.mechanic_id)))
        .toBe(true);
      expect(round.candidates.map((candidate) => candidate.mechanic_id)).not.toEqual(
        expect.arrayContaining(mechanicIds.slice(46))
      );

      const races: Array<{ requestId: string; offerIds: [string, string] }> = [];
      for (let pairIndex = 0; pairIndex < 5; pairIndex += 1) {
        const requestId = uuid(920 + pairIndex);
        await seedRequest(sql, {
          id: requestId,
          sequence: 200 + pairIndex,
          status: "offered"
        });
        races.push({
          requestId,
          offerIds: await seedOfferPair(
            sql,
            requestId,
            mechanicIds[10 + pairIndex * 2]!,
            mechanicIds[11 + pairIndex * 2]!,
            pairIndex
          )
        });
      }

      const accept = new AcceptAssignmentService(new PostgresUnitOfWork(sql), {
        now: () => now
      });
      const contestedStartedAt = performance.now();
      const results = await Promise.allSettled(
        races.flatMap((race, pairIndex) => [
          accept.acceptOffer(identity(mechanicIds[10 + pairIndex * 2]!), race.offerIds[0]),
          accept.acceptOffer(identity(mechanicIds[11 + pairIndex * 2]!), race.offerIds[1])
        ])
      );
      const contestedElapsedMs = performance.now() - contestedStartedAt;

      expect(contestedElapsedMs).toBeLessThan(HOSTED_OPERATION_THRESHOLD_MS);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(5);

      const invariants = await sql<{
        request_id: string;
        assignment_count: number;
        accepted_count: number;
        canceled_count: number;
      }[]>`
        select
          request.id as request_id,
          count(distinct assignment.id)::int as assignment_count,
          count(candidate.id) filter (where candidate.status = 'accepted')::int as accepted_count,
          count(candidate.id) filter (where candidate.status = 'cancelled')::int as canceled_count
        from service_requests request
        left join assignments assignment on assignment.request_id = request.id
        left join dispatch_candidates candidate on candidate.request_id = request.id
        where request.id in ${sql(races.map((race) => race.requestId))}
        group by request.id
        order by request.id
      `;
      expect(invariants).toHaveLength(5);
      expect(invariants).toEqual(
        expect.arrayContaining(
          races.map((race) => ({
            request_id: race.requestId,
            assignment_count: 1,
            accepted_count: 1,
            canceled_count: 1
          }))
        )
      );

      const openTransactions = await sql<{ count: number }[]>`
        select count(*)::int as count
        from pg_stat_activity
        where datname = current_database()
          and state = 'idle in transaction'
          and application_name = current_setting('application_name', true)
      `;
      expect(openTransactions[0]?.count ?? 0).toBe(0);
    } finally {
      await context.dispose();
      await deleteAuthUsers(process.env.TEST_DATABASE_URL!, authUserIds);
    }
  }, 300_000);
});

async function seedIdentityFixtures(sql: Sql) {
  await sql`
    insert into auth.users (id, created_at, updated_at)
    select id, ${now}, ${now}
    from unnest(${sql.array([riderId, ...mechanicIds])}::uuid[]) as ids(id)
    on conflict (id) do nothing
  `;
  await sql`
    insert into app_users (id, status, created_at, updated_at)
    select id, 'active', ${now}, ${now}
    from unnest(${sql.array([riderId, ...mechanicIds])}::uuid[]) as ids(id)
  `;
  await sql`insert into user_roles (user_id, role) values (${riderId}, 'rider')`;
  await sql`
    insert into user_roles (user_id, role)
    select id, 'mechanic'::app_role
    from unnest(${sql.array(mechanicIds)}::uuid[]) as ids(id)
  `;
  await sql`
    insert into motorcycles (
      id, rider_id, brand_text, model_text, created_at, updated_at
    )
    values (${motorcycleId}, ${riderId}, 'Honda', 'Wave', ${now}, ${now})
  `;

  for (let index = 0; index < mechanicIds.length; index += 1) {
    const mechanicId = mechanicIds[index]!;
    const missingLocation = index >= 46 && index < 48;
    const staleLocation = index >= 48;
    const latitude = 10.762622 + index * 0.00001;
    await sql`
      insert into mechanic_profiles (
        user_id, profile_status, is_available, service_radius_km,
        latest_location, location_updated_at, availability_updated_at,
        rating_avg, rating_count, created_at, updated_at
      )
      values (
        ${mechanicId}, 'active', true, 20,
        ${
          missingLocation
            ? null
            : sql`ST_SetSRID(ST_MakePoint(106.660172, ${latitude}), 4326)::geography`
        },
        ${missingLocation ? null : staleLocation ? new Date(now.getTime() - 300_001) : now},
        ${new Date(now.getTime() - index * 1000)}, ${4 + (index % 10) / 10}, ${index},
        ${now}, ${now}
      )
    `;
    await sql`
      insert into mechanic_skills (mechanic_id, service_type, created_at)
      values (${mechanicId}, 'mobile_repair', ${now})
    `;
  }
}

async function seedTenActiveAssignments(sql: Sql, activeMechanics: Set<string>) {
  let index = 0;
  for (const mechanicId of activeMechanics) {
    const requestId = uuid(300 + index);
    await seedRequest(sql, {
      id: requestId,
      sequence: 300 + index,
      status: "offered"
    });
    const [offerId] = await seedOfferPair(
      sql,
      requestId,
      mechanicId,
      mechanicIds[20 + index]!,
      20 + index
    );
    await sql`
      update dispatch_candidates
      set status = 'accepted', responded_at = ${now}
      where id = ${offerId}
    `;
    await sql`
      insert into assignments (
        id, request_id, mechanic_id, accepted_candidate_id, status,
        accepted_at, created_at, updated_at
      )
      values (
        ${uuid(400 + index)}, ${requestId}, ${mechanicId}, ${offerId}, 'accepted',
        ${now}, ${now}, ${now}
      )
    `;
    await sql`
      update service_requests set status = 'assigned', updated_at = ${now}
      where id = ${requestId}
    `;
    index += 1;
  }
}

async function seedRequest(
  sql: Sql,
  input: { id: string; sequence: number; status: "submitted" | "offered" }
) {
  await sql`
    insert into service_requests (
      id, request_code, rider_id, motorcycle_id, service_type,
      problem_description, status, priority, service_location, created_at, updated_at
    )
    values (
      ${input.id}, ${`COR-MOB-20260630-${input.sequence}`}, ${riderId}, ${motorcycleId},
      'mobile_repair', 'Kiem tra xe', ${input.status}, 'normal',
      ST_SetSRID(ST_MakePoint(106.660172, 10.762622), 4326)::geography,
      ${now}, ${now}
    )
  `;
}

async function seedOfferPair(
  sql: Sql,
  requestId: string,
  firstMechanic: string,
  secondMechanic: string,
  pairIndex: number
): Promise<[string, string]> {
  const roundId = uuid(500 + pairIndex);
  const offerIds: [string, string] = [uuid(600 + pairIndex * 2), uuid(601 + pairIndex * 2)];
  const expiresAt = new Date(now.getTime() + 60_000);
  await sql`
    insert into dispatch_rounds (
      id, request_id, round_number, radius_m, status, started_at, expires_at
    )
    values (${roundId}, ${requestId}, 1, 2000, 'active', ${now}, ${expiresAt})
  `;
  await sql`
    insert into dispatch_candidates (
      id, round_id, request_id, mechanic_id, rank, distance_m,
      status, offered_at, expires_at, created_at
    )
    values
      (${offerIds[0]}, ${roundId}, ${requestId}, ${firstMechanic}, 1, 10,
       'offered', ${now}, ${expiresAt}, ${now}),
      (${offerIds[1]}, ${roundId}, ${requestId}, ${secondMechanic}, 2, 20,
       'offered', ${now}, ${expiresAt}, ${now})
  `;
  return offerIds;
}

async function applyMigrations(sql: Pick<Sql, "unsafe">) {
  for (const migrationFile of migrationFiles) {
    await sql.unsafe(
      readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
    );
  }
}

async function deleteAuthUsers(databaseUrl: string, ids: string[]) {
  const postgres = (await import("postgres")).default;
  const admin = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await admin`delete from auth.users where id in ${admin(ids)}`;
  } finally {
    await admin.end({ timeout: 5 });
  }
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://integration-test.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}

function uuid(index: number): string {
  return `10000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}
