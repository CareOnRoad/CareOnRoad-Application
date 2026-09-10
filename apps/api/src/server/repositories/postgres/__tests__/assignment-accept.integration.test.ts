import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AcceptAssignmentService } from "@/features/assignments/accept-assignment.service";
import { AssignmentService } from "@/features/assignments/assignment.service";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import {
  cleanupPostgresTables,
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = legacyCompatibleMigrationFiles();

describeDatabase("assignment acceptance integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let motorcycleId: string;
  let requestA: string;
  let requestB: string;
  let mechanicA: string;
  let mechanicB: string;
  let now: Date;
  let requestSequence: number;
  const authUserIds = new Set<string>();

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 5 });
    sql = context.sql;
    await applyMigrations(sql);
  }, 30_000);

  beforeEach(async () => {
    now = new Date("2026-06-25T05:00:00Z");
    requestSequence = 1;
    riderId = randomUUID();
    motorcycleId = randomUUID();
    requestA = randomUUID();
    requestB = randomUUID();
    mechanicA = randomUUID();
    mechanicB = randomUUID();
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
    await seedMechanic(mechanicA);
    await seedMechanic(mechanicB);
    await seedRequest(requestA, "offered");
    await seedRequest(requestB, "offered");
  }, 30_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: [...authUserIds] });
  }, 30_000);

  it("creates one first-valid assignment, cancels competitors, and writes sanitized audit/outbox", async () => {
    const offerA = await seedOffer(requestA, mechanicA);
    const offerB = await seedOffer(requestA, mechanicB);
    const service = new AcceptAssignmentService(new PostgresUnitOfWork(sql), { now: () => now });

    const assignment = await service.acceptOffer(identity(mechanicA), offerA);

    expect(assignment).toMatchObject({
      request_id: requestA,
      mechanic_id: mechanicA,
      accepted_candidate_id: offerA,
      status: "accepted"
    });
    await expect(sql`select count(*)::int as count from assignments where request_id = ${requestA}`).resolves.toEqual([
      { count: 1 }
    ]);
    await expect(sql`select id, status from dispatch_candidates where id in (${offerA}, ${offerB}) order by id`).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: offerA, status: "accepted" }),
        expect.objectContaining({ id: offerB, status: "cancelled" })
      ])
    );
    await expect(sql`select status from service_requests where id = ${requestA}`).resolves.toEqual([
      { status: "assigned" }
    ]);
    const [historyRows, outboxRows, auditRows] = await Promise.all([
      sql`select * from assignment_status_history where to_status = 'accepted'`,
      sql`select topic, payload from outbox_events where topic = 'assignment.accepted'`,
      sql`select action, metadata from audit_logs where action = 'assignment.accepted'`
    ]);
    expect(historyRows).toHaveLength(1);
    expect(outboxRows).toHaveLength(1);
    expect(auditRows).toHaveLength(1);
    expect(JSON.stringify({ outboxRows, auditRows })).not.toContain("Xe can ho tro");
  }, 30_000);

  it("enforces active-request and active-mechanic partial unique indexes and identity checks", async () => {
    const offerA = await seedOffer(requestA, mechanicA, "accepted");
    await seedAssignment(requestA, mechanicA, offerA);
    const sameRequestOffer = await seedOffer(requestA, mechanicB, "accepted");
    const sameMechanicOffer = await seedOffer(requestB, mechanicA, "accepted");

    await expect(seedAssignment(requestA, mechanicB, sameRequestOffer)).rejects.toBeDefined();
    await expect(seedAssignment(requestB, mechanicA, sameMechanicOffer)).rejects.toBeDefined();
    await expect(seedAssignment(requestB, mechanicB, offerA)).rejects.toBeDefined();
  }, 30_000);

  it("rolls back losing accept writes and supports assignment transitions", async () => {
    const offer = await seedOffer(requestA, mechanicA);
    const assignmentId = randomUUID();
    const occurrenceId = randomUUID();
    await sql`
      insert into outbox_events (
        id, topic, aggregate_type, aggregate_id, dedupe_key, payload
      )
      values (
        ${randomUUID()}, 'assignment.accepted', 'assignment', ${assignmentId},
        ${`assignment.accepted:${assignmentId}:${occurrenceId}`}, '{}'::jsonb
      )
    `;
    const service = new AcceptAssignmentService(new PostgresUnitOfWork(sql), {
      now: () => now,
      createId: sequentialIds([
        assignmentId,
        randomUUID(),
        randomUUID(),
        occurrenceId,
        randomUUID()
      ])
    });

    await expect(service.acceptOffer(identity(mechanicA), offer)).rejects.toBeDefined();
    await expect(sql`select id from assignments where request_id = ${requestA}`).resolves.toHaveLength(0);
    await expect(sql`select status from dispatch_candidates where id = ${offer}`).resolves.toEqual([
      { status: "offered" }
    ]);
    await expect(sql`select status from service_requests where id = ${requestA}`).resolves.toEqual([
      { status: "offered" }
    ]);

    const cleanService = new AcceptAssignmentService(new PostgresUnitOfWork(sql), { now: () => now });
    const assignment = await cleanService.acceptOffer(identity(mechanicA), offer);
    const assignmentService = new AssignmentService(new PostgresUnitOfWork(sql), { now: () => now });
    await expect(
      assignmentService.transitionAssignment(identity(mechanicA), assignment.id, {
        status: "en_route"
      })
    ).resolves.toMatchObject({ status: "en_route" });
    await expect(
      assignmentService.transitionAssignment(identity(mechanicA), assignment.id, {
        status: "on_site"
      })
    ).resolves.toMatchObject({ status: "on_site" });
    await expect(sql`select status from service_requests where id = ${requestA}`).resolves.toEqual([
      { status: "in_service" }
    ]);
  }, 90_000);

  it("covers one request/two mechanics, one mechanic/two requests, and cancel-versus-accept commit orders", async () => {
    const offerA = await seedOffer(requestA, mechanicA);
    const offerB = await seedOffer(requestA, mechanicB);
    const service = new AcceptAssignmentService(new PostgresUnitOfWork(sql), { now: () => now });
    const requestRace = await Promise.allSettled([
      service.acceptOffer(identity(mechanicA), offerA),
      service.acceptOffer(identity(mechanicB), offerB)
    ]);
    expect(requestRace.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const requestRejections = requestRace.filter((result) => result.status === "rejected");
    expect(requestRejections).toHaveLength(1);
    expectConflictRejection(requestRejections[0]!);
    await expect(sql`select count(*)::int as count from assignments where request_id = ${requestA}`).resolves.toEqual([
      { count: 1 }
    ]);
    const requestRaceCandidates =
      await sql`select status from dispatch_candidates where id in (${offerA}, ${offerB})`;
    expect(requestRaceCandidates).toHaveLength(2);
    expect(requestRaceCandidates).toEqual(
      expect.arrayContaining([{ status: "accepted" }, { status: "cancelled" }])
    );

    await resetDomainRows();
    const firstOffer = await seedOffer(requestA, mechanicA);
    const secondOffer = await seedOffer(requestB, mechanicA);
    const mechanicRace = await Promise.allSettled([
      service.acceptOffer(identity(mechanicA), firstOffer),
      service.acceptOffer(identity(mechanicA), secondOffer)
    ]);
    expect(mechanicRace.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const mechanicRejections = mechanicRace.filter((result) => result.status === "rejected");
    expect(mechanicRejections).toHaveLength(1);
    expectConflictRejection(mechanicRejections[0]!);
    await expect(sql`select count(*)::int as count from assignments`).resolves.toEqual([
      { count: 1 }
    ]);
    const mechanicRaceCandidates =
      await sql`select status from dispatch_candidates where id in (${firstOffer}, ${secondOffer})`;
    expect(mechanicRaceCandidates).toHaveLength(2);
    expect(mechanicRaceCandidates).toEqual(
      expect.arrayContaining([{ status: "accepted" }, { status: "offered" }])
    );
    await expect(counts()).resolves.toEqual([
      {
        assignments: 1,
        assignment_history: 1,
        request_history: 1,
        audit: 1,
        outbox: 1
      }
    ]);

    await resetDomainRows();
    const cancelFirstOffer = await seedOffer(requestA, mechanicA);
    await new ServiceRequestService(new PostgresUnitOfWork(sql), {
      now: () => now
    }).cancelServiceRequest(identity(riderId), requestA, { reason: "rider_cancel" });
    const afterCancel = await counts();
    await expect(service.acceptOffer(identity(mechanicA), cancelFirstOffer)).rejects.toMatchObject({
      status: 409,
      errorCode: "CONFLICT"
    });
    await expect(counts()).resolves.toEqual(afterCancel);

    await resetDomainRows();
    const acceptFirstOffer = await seedOffer(requestA, mechanicA);
    await service.acceptOffer(identity(mechanicA), acceptFirstOffer);
    const afterAccept = await counts();
    await expect(
      new ServiceRequestService(new PostgresUnitOfWork(sql), {
        now: () => now
      }).cancelServiceRequest(identity(riderId), requestA, { reason: "late_cancel" })
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    await expect(counts()).resolves.toEqual(afterAccept);
    await expect(
      sql`
        select count(*)::int as count
        from service_requests request
        join assignments assignment on assignment.request_id = request.id
        where request.status = 'canceled'
          and assignment.status in ('accepted', 'en_route', 'on_site', 'diagnosis', 'quoted', 'awaiting_payment', 'in_progress')
      `
    ).resolves.toEqual([{ count: 0 }]);
  }, 120_000);

  async function resetDomainRows() {
    await cleanupPostgresTables(
      sql,
      [
        "assignment_status_history",
        "assignments",
        "dispatch_candidates",
        "dispatch_rounds",
        "request_status_history",
        "service_requests",
        "audit_logs",
        "outbox_events"
      ],
      { resetAppendOnlyAuditLogs: true }
    );
    requestSequence = 1;
    await seedRequest(requestA, "offered");
    await seedRequest(requestB, "offered");
  }

  async function counts() {
    const rows = await sql`
      select
        (select count(*)::int from assignments) as assignments,
        (select count(*)::int from assignment_status_history) as assignment_history,
        (select count(*)::int from request_status_history) as request_history,
        (select count(*)::int from audit_logs) as audit,
        (select count(*)::int from outbox_events) as outbox
    `;
    return rows;
  }

  async function seedRider(id: string) {
    await seedAuthUser(id);
    await sql`insert into app_users (id, status, created_at, updated_at) values (${id}, 'active', now(), now())`;
    await sql`insert into user_roles (user_id, role) values (${id}, 'rider')`;
  }

  async function seedMotorcycle(id: string, ownerId: string) {
    await sql`
      insert into motorcycles (id, rider_id, brand_text, model_text, created_at, updated_at)
      values (${id}, ${ownerId}, 'Honda', 'Wave', now(), now())
    `;
  }

  async function seedMechanic(id: string) {
    await seedAuthUser(id);
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
        ST_SetSRID(ST_MakePoint(106.660172, 10.762622), 4326)::geography,
        ${now}, ${now}, 4, 1, now(), now()
      )
    `;
    await sql`
      insert into mechanic_skills (mechanic_id, service_type)
      values (${id}, 'mobile_repair')
    `;
  }

  async function seedAuthUser(id: string) {
    authUserIds.add(id);
    await sql`insert into auth.users (id, created_at, updated_at) values (${id}, now(), now())`;
  }

  async function seedRequest(id: string, status: "offered") {
    await sql`
      insert into service_requests (
        id, request_code, rider_id, motorcycle_id, service_type, problem_description,
        status, priority, service_location, created_at, updated_at
      )
      values (
        ${id}, ${`COR-MOB-20260625-${requestSequence++}`}, ${riderId}, ${motorcycleId},
        'mobile_repair', 'Xe can ho tro', ${status}, 'normal',
        ST_SetSRID(ST_MakePoint(106.660172, 10.762622), 4326)::geography,
        ${now}, ${now}
      )
    `;
  }

  async function seedOffer(
    requestId: string,
    mechanicId: string,
    status: "offered" | "accepted" = "offered"
  ): Promise<string> {
    const existingRound = await sql<{ id: string }[]>`
      select id
      from dispatch_rounds
      where request_id = ${requestId}
      order by round_number asc
      limit 1
    `;
    const roundId = existingRound[0]?.id ?? randomUUID();
    const offerId = randomUUID();
    if (!existingRound[0]) {
      await sql`
        insert into dispatch_rounds (
          id, request_id, round_number, radius_m, status, started_at, expires_at
        )
        values (
          ${roundId}, ${requestId}, 1, 2000, 'active', ${now},
          ${new Date(now.getTime() + 60_000)}
        )
      `;
    }
    await sql`
      insert into dispatch_candidates (
        id, round_id, request_id, mechanic_id, rank, distance_m, status,
        offered_at, expires_at, responded_at, created_at
      )
      values (
        ${offerId}, ${roundId}, ${requestId}, ${mechanicId}, 1, 20, ${status},
        ${now}, ${new Date(now.getTime() + 60_000)},
        ${status === "accepted" ? now : null}, ${now}
      )
    `;
    return offerId;
  }

  async function seedAssignment(requestId: string, mechanicId: string, offerId: string) {
    await sql`
      insert into assignments (
        id, request_id, mechanic_id, accepted_candidate_id, status,
        accepted_at, created_at, updated_at
      )
      values (${randomUUID()}, ${requestId}, ${mechanicId}, ${offerId}, 'accepted', ${now}, ${now}, ${now})
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

function expectConflictRejection(result: PromiseRejectedResult): void {
  const reason = result.reason as { errorCode?: unknown; status?: unknown };
  expect(["CONFLICT", "DATABASE_CONFLICT"]).toContain(reason.errorCode);
  if (reason.errorCode === "CONFLICT") {
    expect(reason.status).toBe(409);
  }
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
