import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import {
  DISPATCH_OFFER_EXPIRY_SECONDS,
  DISPATCH_TOTAL_WAIT_SECONDS
} from "@/features/dispatch/dispatch-ranking";
import {
  cleanupPostgresTables,
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = legacyCompatibleMigrationFiles();

describeDatabase("dispatch repositories integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let motorcycleId: string;
  let requestId: string;
  let riderIdentity: VerifiedSupabaseIdentity;
  let now: Date;
  let requestSequence: number;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext();
    sql = context.sql;
    riderId = randomUUID();
    motorcycleId = randomUUID();
    requestId = randomUUID();
    riderIdentity = identity(riderId);
    await sql`insert into auth.users (id, created_at, updated_at) values (${riderId}, now(), now())`;
    await applyMigrations(sql);
  }, 30_000);

  beforeEach(async () => {
    now = new Date("2026-06-25T05:00:00Z");
    requestSequence = 1;
    await cleanupPostgresTables(
      sql,
      [
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
    await seedRider(riderId);
    await seedMotorcycle(motorcycleId, riderId);
    await seedRequest(requestId, riderId, motorcycleId);
  }, 30_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: [riderId] });
  }, 30_000);

  it("persists deterministic candidate ordering, expiry, uniqueness, escalation, and audit/outbox rows", async () => {
    const firstMechanic = await seedMechanic({
      latitude: 10.762622,
      longitude: 106.660172,
      ratingAvg: 4.8,
      ratingCount: 0,
      availabilityUpdatedAt: new Date("2026-06-25T04:50:00Z")
    });
    const secondMechanic = await seedMechanic({
      latitude: 10.7629,
      longitude: 106.660172,
      ratingAvg: 4.7,
      ratingCount: 10,
      availabilityUpdatedAt: new Date("2026-06-25T04:40:00Z")
    });
    const activeMechanic = await seedMechanic({
      latitude: 10.7627,
      longitude: 106.660172,
      ratingAvg: 5,
      ratingCount: 4
    });
    await seedMechanic({
      latitude: 10.7627,
      longitude: 106.660172,
      serviceType: "periodic_maintenance"
    });
    await seedMechanic({
      latitude: 10.7627,
      longitude: 106.660172,
      locationUpdatedAt: new Date(now.getTime() - 300_001)
    });
    await seedActiveAssignment(activeMechanic);

    const service = new DispatchService(new PostgresUnitOfWork(sql), {
      now: () => now
    });

    const round = await service.startDispatch(riderIdentity, requestId);

    expect(round.candidates.map((candidate) => candidate.mechanic_id)).toEqual([
      firstMechanic,
      secondMechanic
    ]);
    expect(round.candidates[0]).toMatchObject({ rank: 1, status: "offered" });
    expect(new Date(round.expires_at).getTime() - now.getTime()).toBe(
      DISPATCH_OFFER_EXPIRY_SECONDS * 1000
    );

    await expect(
      sql.unsafe(
        `insert into dispatch_candidates (round_id, request_id, mechanic_id, rank, status)
         values ('${round.id}', '${requestId}', '${firstMechanic}', 3, 'invalid')`
      )
    ).rejects.toBeDefined();
    await expect(
      sql`
        insert into dispatch_candidates (
          round_id, request_id, mechanic_id, rank, distance_m, status, offered_at, expires_at
        )
        values (
          ${round.id}, ${requestId}, ${firstMechanic}, 3, 1, 'offered', ${now},
          ${new Date(now.getTime() + 60_000)}
        )
      `
    ).rejects.toBeDefined();

    const [outboxRows, auditRows] = await Promise.all([
      sql`select topic, payload from outbox_events where topic = 'dispatch.round.started'`,
      sql`select action, metadata from audit_logs where action = 'dispatch.round.started'`
    ]);
    expect(outboxRows).toHaveLength(1);
    expect(auditRows).toHaveLength(1);
    expect(JSON.stringify({ outboxRows, auditRows })).not.toContain("Xe can ho tro");

    now = new Date(now.getTime() + DISPATCH_OFFER_EXPIRY_SECONDS * 1000);
    await service.expireRound(round.id);
    await expect(sql`select status from dispatch_candidates where round_id = ${round.id}`).resolves
      .toEqual(expect.arrayContaining([expect.objectContaining({ status: "expired" })]));
  }, 30_000);

  it("uses four radius rounds, 360-second total wait, active conflict 409, and rollback on outbox conflict", async () => {
    await Promise.all([
      seedMechanic({ latitude: 10.762622, longitude: 106.660172 }),
      seedMechanic({ latitude: 10.79, longitude: 106.660172 }),
      seedMechanic({ latitude: 10.82, longitude: 106.660172 }),
      seedMechanic({ latitude: 10.86, longitude: 106.660172 })
    ]);
    const service = new DispatchService(new PostgresUnitOfWork(sql), { now: () => now });
    const radii: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const round = await service.startDispatch(riderIdentity, requestId);
      radii.push(round.radius_m);
      now = new Date(now.getTime() + DISPATCH_OFFER_EXPIRY_SECONDS * 1000);
      await service.expireRound(round.id);
    }
    expect(radii).toEqual([2000, 5000, 8000, 12000]);
    expect(now.getTime() - new Date("2026-06-25T05:00:00Z").getTime()).toBe(
      DISPATCH_TOTAL_WAIT_SECONDS * 1000 - 120_000
    );
    await expect(sql`select status, manual_escalation_reason from service_requests where id = ${requestId}`).resolves.toEqual([
      expect.objectContaining({
        status: "manual_escalation",
        manual_escalation_reason: "dispatch_rounds_exhausted"
      })
    ]);

    const conflictService = new DispatchService(new PostgresUnitOfWork(sql), {
      now: () => now,
      hasActiveAssignment: async () => true
    });
    await seedRequest(randomUUID(), riderId, motorcycleId);
    await expect(conflictService.startDispatch(riderIdentity, requestId)).rejects.toMatchObject({
      status: 409,
      errorCode: "CONFLICT"
    });
  }, 120_000);

  it("rolls dispatch candidate creation back when required outbox write conflicts", async () => {
    await seedMechanic({ latitude: 10.762622, longitude: 106.660172 });
    const roundId = randomUUID();
    const occurrenceId = randomUUID();
    await sql`
      insert into outbox_events (
        id, topic, aggregate_type, aggregate_id, dedupe_key, payload
      )
      values (
        ${randomUUID()}, 'dispatch.round.started', 'dispatch', ${roundId},
        ${`dispatch.round.started:${roundId}:${occurrenceId}`}, '{}'::jsonb
      )
    `;
    const service = new DispatchService(new PostgresUnitOfWork(sql), {
      now: () => now,
      createId: sequentialIds([roundId, randomUUID(), randomUUID(), randomUUID(), occurrenceId, randomUUID()])
    });

    await expect(service.startDispatch(riderIdentity, requestId)).rejects.toBeDefined();
    await expect(sql`select id from dispatch_rounds`).resolves.toHaveLength(0);
    await expect(sql`select id from dispatch_candidates`).resolves.toHaveLength(0);
    await expect(sql`select status from service_requests where id = ${requestId}`).resolves.toEqual([
      { status: "submitted" }
    ]);
  }, 30_000);

  it("leases one expired round to only one concurrent worker and releases by owner", async () => {
    const roundId = randomUUID();
    await sql`
      insert into dispatch_rounds (
        id, request_id, round_number, radius_m, status, started_at, expires_at
      ) values (
        ${roundId}, ${requestId}, 1, 2000, 'active',
        ${new Date(now.getTime() - 120_000)}, ${new Date(now.getTime() - 60_000)}
      )
    `;
    const unitOfWork = new PostgresUnitOfWork(sql);
    const claim = (leaseOwner: string) =>
      unitOfWork.execute(({ dispatch }) =>
        dispatch.claimExpiredRounds({
          now,
          leaseOwner,
          leaseUntil: new Date(now.getTime() + 60_000),
          limit: 10
        })
      );

    const [first, second] = await Promise.all([claim("worker-a"), claim("worker-b")]);

    expect(first.length + second.length).toBe(1);
    await expect(
      unitOfWork.execute(({ dispatch }) =>
        dispatch.releaseRoundClaim({ id: roundId, leaseOwner: "wrong-worker" })
      )
    ).resolves.toBe(false);
    const owner = first.length ? "worker-a" : "worker-b";
    await expect(
      unitOfWork.execute(({ dispatch }) =>
        dispatch.releaseRoundClaim({ id: roundId, leaseOwner: owner })
      )
    ).resolves.toBe(true);
    await expect(
      sql`select lease_owner, lease_expires_at, failure_count from dispatch_rounds where id = ${roundId}`
    ).resolves.toEqual([
      { lease_owner: null, lease_expires_at: null, failure_count: 1 }
    ]);
  }, 30_000);

  async function seedRider(id: string) {
    await sql`insert into app_users (id, status, created_at, updated_at) values (${id}, 'active', now(), now())`;
    await sql`insert into user_roles (user_id, role) values (${id}, 'rider')`;
  }

  async function seedMotorcycle(id: string, ownerId: string) {
    await sql`
      insert into motorcycles (id, rider_id, brand_text, model_text, created_at, updated_at)
      values (${id}, ${ownerId}, 'Honda', 'Wave', now(), now())
    `;
  }

  async function seedRequest(id: string, ownerId: string, bikeId: string) {
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type, problem_description,
        status, priority, service_location, created_at, updated_at
      )
      values (
        ${id}, ${`COR-MOB-20260625-${requestSequence++}`}, ${ownerId}, ${bikeId},
        'mobile_repair', 'Xe can ho tro', 'submitted', 'normal',
        ST_SetSRID(ST_MakePoint(106.660172, 10.762622), 4326)::geography,
        ${now}, ${now}
      )
    `;
  }

  async function seedMechanic(options: {
    latitude: number;
    longitude: number;
    ratingAvg?: number;
    ratingCount?: number;
    locationUpdatedAt?: Date;
    availabilityUpdatedAt?: Date;
    serviceType?: string;
  }): Promise<string> {
    const id = randomUUID();
    await sql`insert into auth.users (id, created_at, updated_at) values (${id}, now(), now())`;
    await sql`insert into app_users (id, status, created_at, updated_at) values (${id}, 'active', now(), now())`;
    await sql`insert into user_roles (user_id, role) values (${id}, 'mechanic')`;
    await sql`
      insert into mechanic_profiles (
        user_id, profile_status, is_available, service_radius_km, latest_location,
        location_updated_at, availability_updated_at, rating_avg, rating_count,
        created_at, updated_at
      )
      values (
        ${id}, 'active', true, 20,
        ST_SetSRID(ST_MakePoint(${options.longitude}, ${options.latitude}), 4326)::geography,
        ${options.locationUpdatedAt ?? now}, ${options.availabilityUpdatedAt ?? now},
        ${options.ratingAvg ?? 4}, ${options.ratingCount ?? 1}, now(), now()
      )
    `;
    await sql`
      insert into mechanic_skills (mechanic_id, service_type)
      values (${id}, ${options.serviceType ?? "mobile_repair"})
    `;
    return id;
  }

  async function seedActiveAssignment(mechanicId: string) {
    const activeRequestId = randomUUID();
    const roundId = randomUUID();
    const candidateId = randomUUID();
    await seedRequest(activeRequestId, riderId, motorcycleId);
    await sql`
      update service_requests set status = 'assigned' where id = ${activeRequestId}
    `;
    await sql`
      insert into dispatch_rounds (
        id, request_id, round_number, radius_m, status, started_at, expires_at, completed_at
      ) values (
        ${roundId}, ${activeRequestId}, 1, 2000, 'accepted', ${now},
        ${new Date(now.getTime() + 60_000)}, ${now}
      )
    `;
    await sql`
      insert into dispatch_candidates (
        id, round_id, request_id, mechanic_id, rank, distance_m, status,
        offered_at, expires_at, responded_at, created_at
      ) values (
        ${candidateId}, ${roundId}, ${activeRequestId}, ${mechanicId}, 1, 10,
        'accepted', ${now}, ${new Date(now.getTime() + 60_000)}, ${now}, ${now}
      )
    `;
    await sql`
      insert into assignments (
        id, request_id, mechanic_id, accepted_candidate_id, status,
        accepted_at, created_at, updated_at
      ) values (
        ${randomUUID()}, ${activeRequestId}, ${mechanicId}, ${candidateId},
        'accepted', ${now}, ${now}, ${now}
      )
    `;
  }
}, 30_000);

async function applyMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  for (const migrationFile of migrationFiles) {
    await sql.unsafe(
      readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
    );
  }
}

function legacyCompatibleMigrationFiles(): string[] {
  const legacy = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
    .filter(
      (name) => name.endsWith(".sql") && name.localeCompare("202606250014") < 0
    )
    .sort();
  return [...legacy, "202606250021_dispatch_round_leases.sql"];
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://integration-test.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}

function sequentialIds(ids: string[]): () => string {
  return () => {
    const id = ids.shift();
    if (!id) {
      throw new Error("Test ID sequence exhausted.");
    }
    return id;
  };
}
