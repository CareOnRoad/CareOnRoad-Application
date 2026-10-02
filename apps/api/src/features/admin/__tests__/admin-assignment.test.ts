import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { QuoteService } from "@/features/quotes/quote.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { AdminAssignmentService } from "../admin-assignment.service";
import { createAdminAssignmentRouteHandlers } from "../admin-assignment.route-handlers";

const now = new Date("2026-10-02T00:00:00Z");
const rider = randomUUID(), admin = randomUUID(), mechanic = randomUUID(), second = randomUUID(), requestId = randomUUID(), bikeId = randomUUID();
const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"] });
const reason = "Checked request and confirmed mechanic eligibility";
function fixture() {
  return new InMemoryUnitOfWork({
    users: [rider, admin, mechanic, second].map((id) => ({ id, status: "active", createdAt: now, updatedAt: now })),
    userRoles: [{ userId: rider, role: "rider" }, { userId: admin, role: "admin" }, ...[mechanic, second].map((userId) => ({ userId, role: "mechanic" as const }))],
    motorcycles: [{ id: bikeId, riderId: rider, brandText: "Honda", modelText: "Wave", createdAt: now, updatedAt: now }],
    serviceRequests: [{ id: requestId, requestCode: "TEST", riderId: rider, motorcycleId: bikeId, serviceType: "emergency_rescue",
      problemDescription: "private problem", addressText: "private address", status: "manual_escalation", priority: "normal",
      serviceLocation: { latitude: 10.77, longitude: 106.69 }, createdAt: now, updatedAt: now }],
    mechanicProfiles: [mechanic, second].map((userId) => ({ userId, profileStatus: "active", isAvailable: true, serviceRadiusKm: 20,
      latestLocation: { latitude: 10.7705, longitude: 106.69 }, locationUpdatedAt: now, availabilityUpdatedAt: now,
      ratingAvg: 4, ratingCount: 1, serviceTypes: ["emergency_rescue"], createdAt: now, updatedAt: now }))
  });
}
async function assign(uow: InMemoryUnitOfWork) {
  const service = new AdminAssignmentService(uow, { now: () => now });
  const result = await service.command(identity(admin), requestId, "manual_assign", { reason, mechanic_id: mechanic }, "manual-first-key");
  return { service, id: result.id as string };
}

describe("admin assignment operations", () => {
  it("creates a real manual source and uses its server distance for rescue labor pricing", async () => {
    const uow = fixture(); const { service, id } = await assign(uow);
    expect(uow.snapshot().assignments[0]).toMatchObject({ source: "admin_manual", assignedByAdminId: admin, dispatchDistanceMeters: expect.any(Number) });
    expect(uow.snapshot().assignments[0]!.acceptedCandidateId).toBeUndefined();
    expect(await service.command(identity(admin), requestId, "manual_assign", { reason, mechanic_id: mechanic }, "manual-first-key")).toMatchObject({ id });
    const quote = await new QuoteService(uow, { now: () => now }).createQuote(identity(mechanic), requestId, { assignment_id: id, purpose: "rescue_labor",
      labor_pricing: { base_amount: 100_000, distance_amount: 10_000, weather_amount: 0, time_amount: 0, weather: "sunny" } });
    expect(quote.labor_pricing!.distance_m).toBe(uow.snapshot().assignments[0]!.dispatchDistanceMeters);
    const detail = await service.read(identity(admin), id, "detail");
    expect(detail).toMatchObject({ commitment_reason_codes: ["quote_already_issued"], next_action_codes: ["add_note", "investigate"] });
    expect(JSON.stringify(detail)).not.toMatch(/private|latitude|longitude|note_text/);
    await expect(service.command(identity(admin), id, "reassign", { reason, mechanic_id: second }, "blocked-quoted-key")).rejects.toMatchObject({ status: 409 });
  });

  it("serializes manual/reassignment races and preserves both histories and actor notifications", async () => {
    const uow = fixture(); const service = new AdminAssignmentService(uow, { now: () => now });
    const first = await Promise.allSettled([mechanic, second].map((mechanic_id) => service.command(identity(admin), requestId, "manual_assign", { reason, mechanic_id }, `manual-${mechanic_id}`)));
    expect(first.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    const old = uow.snapshot().assignments[0]!; const target = old.mechanicId === mechanic ? second : mechanic;
    const next = await Promise.allSettled([1, 2].map((i) => service.command(identity(admin), old.id, "reassign", { reason, mechanic_id: target }, `replace-key-${i}`)));
    expect(next.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    const state = uow.snapshot(); expect(state.assignments).toHaveLength(2);
    expect(state.assignments[0]).toMatchObject({ status: "recovery_canceled" });
    expect(state.assignments[1]).toMatchObject({ source: "admin_reassignment", supersedesAssignmentId: old.id, status: "accepted" });
    expect(state.assignmentStatusHistory.map((row) => row.toStatus)).toEqual(["accepted", "recovery_canceled", "accepted"]);
    expect(state.notifications).toEqual(expect.arrayContaining([expect.objectContaining({ userId: old.mechanicId, type: "assignment.reassigned" }), expect.objectContaining({ userId: target, type: "assignment.admin_assigned" })]));
  });

  it.each(["inactive", "stale", "skill", "role", "unavailable", "radius", "money", "archived"])("rejects %s and rolls back every side effect", async (blocker) => {
    const state = fixture().snapshot(); const profile = state.mechanicProfiles[0]!;
    if (blocker === "inactive") profile.profileStatus = "suspended";
    if (blocker === "stale") profile.locationUpdatedAt = new Date(now.getTime() - 301_000);
    if (blocker === "skill") profile.serviceTypes = [];
    if (blocker === "role") state.userRoles = state.userRoles.filter((row) => row.userId !== mechanic);
    if (blocker === "unavailable") profile.isAvailable = false;
    if (blocker === "radius") profile.latestLocation = { latitude: 11, longitude: 107 };
    if (blocker === "archived") state.motorcycles[0]!.archivedAt = now;
    if (blocker === "money") state.paymentOrders.push({ id: randomUUID(), requestId, assignmentId: randomUUID(), quoteId: randomUUID(), riderId: rider, provider: "payos", providerOrderCode: 1, status: "needs_review", currency: "VND", amount: 100, description: "private", createdAt: now, updatedAt: now });
    const uow = new InMemoryUnitOfWork(state); const before = uow.snapshot();
    await expect(assign(uow)).rejects.toMatchObject({ status: 409 }); expect(uow.snapshot()).toEqual(before);
  });

  it("requires scheduled duration, protects the full buffered reservation and leaves current work separate", async () => {
    const state = fixture().snapshot(); state.serviceRequests[0]!.scheduledStartAt = new Date(now.getTime() + 86_400_000);
    const uow = new InMemoryUnitOfWork(state); await expect(assign(uow)).rejects.toMatchObject({ status: 400 });
    const service = new AdminAssignmentService(uow, { now: () => now });
    const result = await service.command(identity(admin), requestId, "manual_assign", { reason, mechanic_id: mechanic, estimated_duration_minutes: 90 }, "scheduled-manual-key");
    expect(uow.snapshot().assignments[0]!.reservationEndAt!.getTime() - uow.snapshot().assignments[0]!.reservationStartAt!.getTime()).toBe(150 * 60_000);
    expect(await service.read(identity(admin), result.id as string, "detail")).toMatchObject({ work_slot: "future_reservation" });
  });

  it("records private investigations, bounded timelines and canonical cancellation without force status", async () => {
    const uow = fixture(); const { service, id } = await assign(uow);
    await service.command(identity(admin), id, "resolve_stuck", { reason, action: "investigate", note: "private investigation" }, "investigate-key");
    const timeline = await service.read(identity(admin), id, "timeline", { limit: 1 });
    expect(timeline).toMatchObject({ items: [expect.any(Object)], page: { has_more: true } }); expect(JSON.stringify(timeline)).not.toContain("private");
    await service.command(identity(admin), id, "cancel", { reason }, "cancel-assignment-key");
    expect(uow.snapshot().assignments[0]!.status).toBe("canceled"); expect(uow.snapshot().serviceRequests[0]!.status).toBe("canceled");
    const routes = createAdminAssignmentRouteHandlers({ authenticate: async () => identity(rider), service });
    expect((await routes.read(new Request("http://localhost/"), id, "detail")).status).toBe(403);
    const adminRoutes = createAdminAssignmentRouteHandlers({ authenticate: async () => identity(admin), service });
    expect((await adminRoutes.command(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ reason, status: "completed" }), headers: { "x-idempotency-key": "valid-key" } }), id, "cancel")).status).toBe(400);
  });

  it("rolls back manual source and inbox creation if the admin audit cannot append", async () => {
    const uow = fixture(); const before = uow.snapshot();
    const failing: UnitOfWork = { execute: (work) => uow.execute((repositories) => work({ ...repositories, audit: { query: (input) => repositories.audit.query(input), append: async () => { throw new Error("audit unavailable"); } } })) };
    await expect(new AdminAssignmentService(failing, { now: () => now }).command(identity(admin), requestId, "manual_assign", { reason, mechanic_id: mechanic }, "audit-rollback-key")).rejects.toThrow("audit unavailable");
    expect(uow.snapshot()).toEqual(before);
  });

  it.each([admin, rider])("rechecks current roles after waiting for the target profile lock (%s)", async (revokedId) => {
    const uow = fixture(); const before = uow.snapshot();
    const waiting: UnitOfWork = { execute: (work) => uow.execute((repositories) => {
      let locked = false;
      return work({ ...repositories,
        mechanics: new Proxy(repositories.mechanics, { get: (target, property) => property === "findProfileByUserIdForUpdate" ? async (id: string) => {
          const profile = await target.findProfileByUserIdForUpdate(id); locked = true; return profile;
        } : Reflect.get(target, property) }),
        users: new Proxy(repositories.users, { get: (target, property) => property === "findActorById" ? async (id: string) => {
          const actor = await target.findActorById(id);
          return actor && locked && id === revokedId ? { ...actor, roles: [] } : actor;
        } : Reflect.get(target, property) })
      });
    }) };
    await expect(new AdminAssignmentService(waiting, { now: () => now }).command(identity(admin), requestId, "manual_assign", { reason, mechanic_id: mechanic }, "revoke-during-wait-key"))
      .rejects.toMatchObject({ status: revokedId === admin ? 403 : 409 });
    expect(uow.snapshot()).toEqual(before);
  });
});
