import { readdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AdminAssignmentService } from "@/features/admin/admin-assignment.service";
import { QuoteService } from "@/features/quotes/quote.service";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { AcceptAssignmentService } from "@/features/assignments/accept-assignment.service";
import { createDispatchRouteHandlers } from "@/features/dispatch/dispatch.route-handlers";
import { DispatchWorker } from "@/server/workers/dispatch.worker";
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
const migrationFiles = sourceMigrationFiles();

describeDatabase("dispatch repositories integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let riderId: string;
  let motorcycleId: string;
  let requestId: string;
  let riderIdentity: VerifiedSupabaseIdentity;
  let now: Date;
  let requestSequence: number;
  const authUserIds = new Set<string>();

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext();
    sql = context.sql;
    riderId = randomUUID();
    motorcycleId = randomUUID();
    requestId = randomUUID();
    riderIdentity = identity(riderId);
    await sql`insert into auth.users (id, created_at, updated_at) values (${riderId}, now(), now())`;
    authUserIds.add(riderId);
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
      { resetAppendOnlyTables: true }
    );
    await seedRider(riderId);
    await seedMotorcycle(motorcycleId, riderId);
    await seedRequest(requestId, riderId, motorcycleId);
  }, 30_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: [...authUserIds] });
  }, 30_000);

  it("serializes manual assignments and reassignments with real provenance and immutable distance", async () => {
    await sql`insert into user_roles (user_id, role) values (${riderId}, 'admin')`;
    const first = await seedMechanic({ latitude: 10.762622, longitude: 106.660172 });
    const second = await seedMechanic({ latitude: 10.7627, longitude: 106.660172 });
    const service = new AdminAssignmentService(new PostgresUnitOfWork(sql), { now: () => now });
    const reason = "Checked manual assignment before recovery";
    const races = await Promise.allSettled([first, second].map((mechanic_id) => service.command(riderIdentity, requestId, "manual_assign", { reason, mechanic_id }, `manual-race-${mechanic_id}`)));
    expect(races.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [old] = await sql<{ id: string; mechanic_id: string; source: string; accepted_candidate_id: null; dispatch_distance_m: number }[]>`select * from assignments where request_id = ${requestId}`;
    expect(old).toMatchObject({ source: "admin_manual", accepted_candidate_id: null, dispatch_distance_m: expect.any(Number) });
    const mechanic_id = old!.mechanic_id === first ? second : first;
    const replacements = await Promise.allSettled([1, 2].map((i) => service.command(riderIdentity, old!.id, "reassign", { reason, mechanic_id }, `replacement-race-${i}`)));
    expect(replacements.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [replacement] = await sql<{ id: string }[]>`select id from assignments where supersedes_assignment_id = ${old!.id}`;
    expect(replacement).toBeDefined();
    expect(await sql`select id from assignments where request_id = ${requestId} and status = 'accepted'`).toHaveLength(1);
    expect(await sql`select id from assignment_status_history`).toHaveLength(3);
    await expect(sql`update assignments set dispatch_distance_m = 999 where id = ${replacement!.id}`).rejects.toMatchObject({ code: "23514" });
    expect(await service.read(riderIdentity, replacement!.id, "detail")).toMatchObject({ source: "admin_reassignment", accepted_candidate_id: null, supersedes_assignment_id: old!.id });
    await sql`update service_requests set service_type = 'emergency_rescue' where id = ${requestId}`;
    const quote = await new QuoteService(new PostgresUnitOfWork(sql), { now: () => now }).createQuote(identity(mechanic_id), requestId, { assignment_id: replacement!.id, purpose: "rescue_labor", labor_pricing: { base_amount: 100_000, distance_amount: 10_000, weather_amount: 0, time_amount: 0, weather: "sunny" } });
    expect(quote.labor_pricing!.distance_m).toBeGreaterThanOrEqual(0);
    await expect(service.command(riderIdentity, replacement!.id, "cancel", { reason }, "quoted-admin-cancel")).rejects.toMatchObject({ status: 409 });
  }, 30_000);

  it("locks the mechanic across competing requests and rechecks its full reservation", async () => {
    await sql`insert into user_roles (user_id, role) values (${riderId}, 'admin')`;
    const mechanic_id = await seedMechanic({ latitude: 10.762622, longitude: 106.660172 });
    const other = randomUUID(); await seedRequest(other, riderId, motorcycleId);
    const service = new AdminAssignmentService(new PostgresUnitOfWork(sql), { now: () => now });
    const body = { reason: "Checked mechanic for concurrent requests", mechanic_id };
    const race = await Promise.allSettled([requestId, other].map((id) => service.command(riderIdentity, id, "manual_assign", body, `cross-request-${id}`)));
    expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(race.filter((r) => r.status === "rejected").every((r) => r.status === "rejected" && r.reason.status === 409)).toBe(true);
    expect(await sql`select id from assignments where mechanic_id = ${mechanic_id} and status = 'accepted'`).toHaveLength(1);
  }, 30_000);

  it("serializes concurrent admin retries, worker recovery and acceptance/cancellation without duplicate active work", async () => {
    await sql`insert into user_roles (user_id, role) values (${riderId}, 'admin')`;
    const mechanic = await seedMechanic({ latitude: 10.762622, longitude: 106.660172 });
    const uow = new PostgresUnitOfWork(sql); const service = new DispatchService(uow, { now: () => now });
    const reason = { reason: "Checked dispatch before retrying" };
    const first = await service.startDispatch(riderIdentity, requestId);
    await service.commandAdminDispatch(riderIdentity, requestId, "cancel", reason, "admin-stop-first");
    const retries = await Promise.allSettled(["retry-one", "retry-two"].map((key) => service.commandAdminDispatch(riderIdentity, requestId, "retry", reason, key)));
    expect(retries.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await service.processClaimedRound(first.id, "old-worker")).toBe("skipped");
    const [round] = await sql<{ id: string }[]>`select id from dispatch_rounds where request_id = ${requestId} and status = 'active'`;
    expect(await sql`select id from dispatch_rounds where request_id = ${requestId}`).toHaveLength(2);
    const [offer] = await sql<{ id: string }[]>`select id from dispatch_candidates where round_id = ${round!.id}`;
    const accept = new AcceptAssignmentService(uow, { now: () => now });
    await expect(accept.acceptOffer(identity(mechanic), first.candidates[0]!.id)).rejects.toMatchObject({ status: 409 });
    const race = await Promise.allSettled([
      accept.acceptOffer(identity(mechanic), offer!.id),
      service.commandAdminDispatch(riderIdentity, requestId, "cancel", reason, "race-cancel-dispatch")
    ]);
    expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(race.filter((r) => r.status === "rejected").every((r) => r.status === "rejected" && r.reason.status === 409)).toBe(true);
    const assignments = await sql`select id from assignments where request_id = ${requestId} and status = 'accepted'`;
    expect(assignments.length).toBeLessThanOrEqual(1);
    expect(await sql`select id from dispatch_rounds where request_id = ${requestId} and status = 'active'`).toHaveLength(0);
  }, 30_000);

  it("persists a capped new episode, idempotent replay and no rewriting of exhausted rounds", async () => {
    await sql`insert into user_roles (user_id, role) values (${riderId}, 'admin')`;
    await seedMechanic({ latitude: 10.762622, longitude: 106.660172 });
    await sql`update service_requests set status = 'manual_escalation' where id = ${requestId}`;
    for (let index = 0; index < 4; index++) await sql`insert into dispatch_rounds (id, request_id, round_number, radius_m, status, started_at, expires_at)
      values (${randomUUID()}, ${requestId}, ${index + 1}, 2000, 'expired', ${new Date(now.getTime() - (4 - index) * 60_000)}, ${new Date(now.getTime() - (3 - index) * 60_000)})`;
    const history = await sql`select * from dispatch_rounds order by round_number`;
    const service = new DispatchService(new PostgresUnitOfWork(sql), { now: () => now });
    const reason = { reason: "Checked exhausted search and retry" };
    for (let index = 0; index < 3; index++) {
      const key = `episode-retry-${index}`;
      const results = await Promise.all([1, 2].map(() => service.commandAdminDispatch(riderIdentity, requestId, "retry", reason, key)));
      expect(results[0]).toEqual(results[1]); expect(results[0]).toMatchObject({ retry_count: index + 1, episode_start_round: index + 5 });
      await service.commandAdminDispatch(riderIdentity, requestId, "cancel", reason, `episode-stop-${index}`);
    }
    await expect(service.commandAdminDispatch(riderIdentity, requestId, "retry", reason, "episode-over-limit")).rejects.toMatchObject({ status: 409 });
    expect(await sql`select * from dispatch_rounds where round_number <= 4 order by round_number`).toEqual(history);
    expect(await sql`select retry_count from (select dispatch_retry_count as retry_count from service_requests where id = ${requestId}) r`).toEqual([{ retry_count: 3 }]);
    expect(await sql`select id from outbox_events where topic = 'admin.dispatch.retry'`).toHaveLength(3);
    expect(await sql`select id from idempotency_records where idempotency_key = 'episode-over-limit'`).toHaveLength(0);
  }, 30_000);

  it("uses native eligibility for all reasons, stable admin pages and overdue lease protection", async () => {
    await sql`insert into user_roles (user_id, role) values (${riderId}, 'admin')`;
    const available = await seedMechanic({ latitude: 10.762622, longitude: 106.660172 });
    const busy = await seedMechanic({ latitude: 10.762622, longitude: 106.660172 }); await seedActiveAssignment(busy);
    await sql`update assignments set reservation_start_at = ${now}, reservation_end_at = ${new Date(now.getTime() + 60_000)} where mechanic_id = ${busy}`;
    const blocked = await seedMechanic({ latitude: 11, longitude: 106.660172, serviceType: "emergency_rescue", locationUpdatedAt: new Date(now.getTime() - 600_000) });
    await sql`update app_users set status = 'suspended' where id = ${blocked}`;
    await sql`update mechanic_profiles set is_available = false where user_id = ${blocked}`;
    await sql`delete from user_roles where user_id = ${blocked} and role = 'mechanic'`;
    const service = new DispatchService(new PostgresUnitOfWork(sql), { now: () => now });
    const explanation = await service.readAdminDispatch(riderIdentity, requestId, "explanation", { limit: 100 });
    expect(explanation).toMatchObject({ reason_counts_scope: "page", items: expect.arrayContaining([
      expect.objectContaining({ mechanic_id: busy, reason_codes: expect.arrayContaining(["current_work", "reservation_conflict"]) }),
      expect.objectContaining({ mechanic_id: blocked, reason_codes: expect.arrayContaining(["user_inactive", "mechanic_role_missing", "unavailable", "skill_mismatch", "location_stale", "outside_radius"]) })
    ]) });
    expect(JSON.stringify(explanation)).not.toMatch(/latitude|longitude|latest_location|lease_owner|problem_description/);
    expect(await service.readAdminDispatch(riderIdentity, requestId, "eligible")).toMatchObject({ items: [expect.objectContaining({ mechanic_id: available })] });
    const first = await service.readAdminDispatch(riderIdentity, requestId, "explanation", { limit: 1 });
    if (!("page" in first) || !("items" in first)) throw new Error("Missing page");
    const second = await service.readAdminDispatch(riderIdentity, requestId, "explanation", { limit: 1, cursor: first.page.next_cursor });
    if (!("page" in second) || !("items" in second)) throw new Error("Missing page");
    const third = await service.readAdminDispatch(riderIdentity, requestId, "explanation", { limit: 1, cursor: second.page.next_cursor });
    expect(third).toMatchObject({ page: { has_more: false } });
    if (!("items" in third)) throw new Error("Missing page");
    expect(new Set([...first.items, ...second.items, ...third.items].map((item) => "mechanic_id" in item ? item.mechanic_id : undefined)).size).toBe(3);
    const round = await service.startDispatch(riderIdentity, requestId); const reason = { reason: "Expired search requires intervention" };
    await expect(service.commandAdminDispatch(riderIdentity, round.id, "expire", reason, "early-round-expire")).rejects.toMatchObject({ status: 409 });
    now = new Date(now.getTime() + 61_000);
    await sql`update dispatch_rounds set lease_owner = 'worker', lease_expires_at = ${new Date(now.getTime() + 60_000)} where id = ${round.id}`;
    await expect(service.commandAdminDispatch(riderIdentity, round.id, "expire", reason, "leased-round-expire")).rejects.toMatchObject({ status: 409 });
    await sql`update dispatch_rounds set lease_owner = null, lease_expires_at = null where id = ${round.id}`;
    await service.commandAdminDispatch(riderIdentity, round.id, "expire", reason, "overdue-round-expire");
    expect(await service.readAdminRound(riderIdentity, round.id)).toMatchObject({ status: "expired", worker_lease_active: false });
    expect(await service.readAdminDispatch(riderIdentity, requestId, "status")).toMatchObject({ request_status: "manual_escalation", next_action_codes: expect.arrayContaining(["retry_dispatch"]) });
    await expect(service.commandAdminDispatch(identity(available), requestId, "retry", reason, "mechanic-role-retry")).rejects.toMatchObject({ status: 403 });
  }, 30_000);

  it.each(["rounds", "total_wait"])("persists %s escalation in PostgreSQL despite a 409 route response and retry", async (limit) => {
    await sql`update service_requests set status = 'offered' where id = ${requestId}`;
    const count = limit === "rounds" ? 4 : 1;
    for (let index = 0; index < count; index++) {
      await sql`insert into dispatch_rounds (id, request_id, round_number, radius_m, status, started_at, expires_at)
        values (${randomUUID()}, ${requestId}, ${index + 1}, 2000, ${index === count - 1 ? "active" : "expired"},
          ${new Date(now.getTime() - (limit === "total_wait" ? 360000 : (4 - index) * 60000))}, ${now})`;
    }
    const unit = new PostgresUnitOfWork(sql);
    const handlers = createDispatchRouteHandlers({ authenticate: async () => riderIdentity,
      dispatchService: new DispatchService(unit, { now: () => now }) });
    const dispatchRequest = () => new Request(`https://example.test/api/v1/service-requests/${requestId}/dispatch`, { method: "POST" });
    const response = await handlers.startDispatch(dispatchRequest(), requestId);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error_code: "CONFLICT" });
    expect(await sql`select status from service_requests where id = ${requestId}`).toEqual([{ status: "manual_escalation" }]);
    expect(await sql`select * from dispatch_rounds where request_id = ${requestId} and status = 'active'`).toHaveLength(0);
    expect(await sql`select * from request_status_history where request_id = ${requestId} and to_status = 'manual_escalation'`).toHaveLength(1);
    expect(await sql`select * from audit_logs where request_id = ${requestId} and action = 'dispatch.request.manual_escalated'`).toHaveLength(1);
    expect(await sql`select * from outbox_events where topic = 'dispatch.request.manual_escalated'`).toHaveLength(1);
    expect((await handlers.startDispatch(dispatchRequest(), requestId)).status).toBe(409);
    expect(await new DispatchWorker(unit, { now: () => now, workerId: "escalation-retry-test" }).processBatch()).toMatchObject({ claimed: 0 });
    expect(await sql`select * from outbox_events where topic = 'dispatch.request.manual_escalated'`).toHaveLength(1);
  });

  it("persists expired decline before 409 and worker retry expires the round only once", async () => {
    const mechanicId = await seedMechanic({ latitude: 10.762622, longitude: 106.660172 });
    const unit = new PostgresUnitOfWork(sql);
    const service = new DispatchService(unit, { now: () => now });
    const round = await service.startDispatch(riderIdentity, requestId);
    const offer = round.candidates[0]!;
    now = new Date(round.expires_at);
    const handlers = createDispatchRouteHandlers({ authenticate: async () => identity(mechanicId), dispatchService: service });
    const declineRequest = () => new Request(`https://example.test/api/v1/dispatch/offers/${offer.id}/decline`, { method: "POST" });
    expect((await handlers.declineOffer(declineRequest(), offer.id)).status).toBe(409);
    expect(await sql`select status from dispatch_candidates where id = ${offer.id}`).toEqual([{ status: "expired" }]);
    expect((await handlers.declineOffer(declineRequest(), offer.id)).status).toBe(409);
    expect(await sql`select * from outbox_events where topic = 'dispatch.candidate.expired'`).toHaveLength(1);
    const worker = new DispatchWorker(unit, { now: () => now, workerId: "decline-expiry-worker" });
    expect(await worker.processBatch()).toMatchObject({ claimed: 1, advanced: 1, failed: 0 });
    expect(await worker.processBatch()).toMatchObject({ claimed: 0 });
    await service.expireRound(round.id);
    expect(await sql`select * from outbox_events where topic = 'dispatch.round.expired'`).toHaveLength(1);
  });

  it("opens exactly one next round on concurrent rider retry without waiting for an expiry worker", async () => {
    await seedMechanic({ latitude: 10.762622, longitude: 106.660172 });
    const unit = new PostgresUnitOfWork(sql);
    const service = new DispatchService(unit, { now: () => now });
    const first = await service.startDispatch(riderIdentity, requestId);
    now = new Date(first.expires_at);
    const outcomes = await Promise.allSettled([service.startDispatch(riderIdentity, requestId), service.startDispatch(riderIdentity, requestId)]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(await sql`select status from dispatch_rounds where id = ${first.id}`).toEqual([{ status: "expired" }]);
    expect(await sql`select * from dispatch_rounds where status = 'active'`).toHaveLength(1);
    expect(await sql`select * from outbox_events where topic = 'dispatch.round.expired'`).toHaveLength(1);
  });

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
    authUserIds.add(id);
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

function sourceMigrationFiles(): string[] {
  return readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
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
