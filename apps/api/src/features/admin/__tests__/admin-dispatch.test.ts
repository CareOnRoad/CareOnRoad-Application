import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DispatchService, MAX_ADMIN_DISPATCH_RETRIES } from "@/features/dispatch/dispatch.service";
import { deliverOutboxEvent } from "@/features/outbox/outbox-consumers";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { createAdminDispatchRouteHandlers } from "../admin-dispatch.route-handlers";

const now = new Date("2026-10-02T00:00:00Z");
const rider = randomUUID(); const admin = randomUUID(); const mechanic = randomUUID(); const requestId = randomUUID();
const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"] });
const reason = { reason: "Retry after checking the request" };

function fixture() {
  const uow = new InMemoryUnitOfWork({
    users: [rider, admin, mechanic].map((id) => ({ id, status: "active", createdAt: now, updatedAt: now })),
    userRoles: [{ userId: rider, role: "rider" }, { userId: admin, role: "admin" }, { userId: mechanic, role: "mechanic" }],
    serviceRequests: [{ id: requestId, requestCode: "TEST", riderId: rider, motorcycleId: randomUUID(), serviceType: "mobile_repair",
      problemDescription: "Private rider description", status: "manual_escalation", priority: "normal",
      serviceLocation: { latitude: 10.77, longitude: 106.69 }, createdAt: now, updatedAt: now }],
    mechanicProfiles: [{ userId: mechanic, profileStatus: "active", isAvailable: true, serviceRadiusKm: 20,
      latestLocation: { latitude: 10.77, longitude: 106.69 }, locationUpdatedAt: now, availabilityUpdatedAt: now,
      ratingAvg: 4, ratingCount: 1, serviceTypes: ["mobile_repair"], createdAt: now, updatedAt: now }],
    dispatchRounds: Array.from({ length: 4 }, (_, i) => ({ id: randomUUID(), requestId, roundNumber: i + 1,
      radiusMeters: 2000, status: "expired", startedAt: new Date(now.getTime() - (4 - i) * 60_000),
      expiresAt: new Date(now.getTime() - (3 - i) * 60_000) }))
  });
  return uow;
}

describe("admin dispatch", () => {
  it("rolls back the episode, round, notification and idempotency if the final admin audit fails", async () => {
    const uow = fixture(); const before = uow.snapshot();
    const failing: UnitOfWork = { execute: (work) => uow.execute((repositories) => work({ ...repositories,
      audit: { ...repositories.audit, query: (input) => repositories.audit.query(input), append: async (log) => {
        if (log.action === "admin.dispatch.retry") throw new Error("audit unavailable");
        return repositories.audit.append(log);
      } }
    })) };
    await expect(new DispatchService(failing, { now: () => now }).commandAdminDispatch(identity(admin), requestId, "retry", reason, "audit-failure-retry"))
      .rejects.toThrow("audit unavailable");
    expect(uow.snapshot()).toEqual(before);
  });

  it.each(["assignment", "quote", "money", "rider", "location", "elapsed_schedule"])("blocks unsafe %s retries without residue", async (blocker) => {
    const state = fixture().snapshot();
    if (blocker === "rider") state.users.find((u) => u.id === rider)!.status = "suspended";
    if (blocker === "location") state.serviceRequests[0]!.serviceLocation = undefined;
    if (blocker === "elapsed_schedule") state.serviceRequests[0]!.scheduledStartAt = now;
    if (blocker === "assignment") state.assignments.push({ id: randomUUID(), requestId, mechanicId: mechanic, acceptedCandidateId: randomUUID(),
      scheduledStartAt: new Date(now.getTime() + 86_400_000), status: "accepted", acceptedAt: now, createdAt: now, updatedAt: now });
    if (blocker === "quote") state.quotes.push({ id: randomUUID(), requestId, assignmentId: randomUUID(), version: 1, status: "pending",
      currency: "VND", subtotalAmount: 100, discountAmount: 0, totalAmount: 100, createdBy: mechanic, createdAt: now, lines: [] });
    if (blocker === "money") state.paymentOrders.push({ id: randomUUID(), requestId, assignmentId: randomUUID(), quoteId: randomUUID(), riderId: rider,
      provider: "payos", providerOrderCode: 100, status: "needs_review", currency: "VND", amount: 100, description: "test", createdAt: now, updatedAt: now });
    const uow = new InMemoryUnitOfWork(state); const before = uow.snapshot();
    await expect(new DispatchService(uow, { now: () => now }).commandAdminDispatch(identity(admin), requestId, "retry", reason, "unsafe-retry-test"))
      .rejects.toMatchObject({ status: 409 });
    expect(uow.snapshot()).toEqual(before);
  });
  it("opens at most three new episodes, replays idempotency and keeps history/outbox results correct", async () => {
    const uow = fixture(); const service = new DispatchService(uow, { now: () => now }); const initial = uow.snapshot().dispatchRounds;
    for (let index = 0; index < MAX_ADMIN_DISPATCH_RETRIES; index++) {
      const result = await service.commandAdminDispatch(identity(admin), requestId, "retry", reason, `retry-key-${index}`);
      expect(result).toMatchObject({ request_status: "offered", retry_count: index + 1,
        episode_start_round: index + 5, round: { round_number: index + 5, radius_m: 2000, candidates: [expect.objectContaining({ mechanic_id: mechanic })] } });
      expect(await service.commandAdminDispatch(identity(admin), requestId, "retry", reason, `retry-key-${index}`)).toEqual(result);
      await expect(service.commandAdminDispatch(identity(admin), requestId, "retry", { reason: "Different retry reason" }, `retry-key-${index}`)).rejects.toMatchObject({ status: 409 });
      await service.commandAdminDispatch(identity(admin), requestId, "cancel", reason, `cancel-key-${index}`);
      expect(uow.snapshot().serviceRequests[0]!.status).toBe("manual_escalation");
    }
    const before = uow.snapshot();
    await expect(service.commandAdminDispatch(identity(admin), requestId, "retry", reason, "retry-limit-key")).rejects.toMatchObject({ status: 409 });
    expect(uow.snapshot()).toEqual(before); expect(before.dispatchRounds.slice(0, 4)).toEqual(initial);
    expect(before.dispatchRounds.filter((r) => r.status === "active")).toHaveLength(0);
    expect(before.dispatchCandidates.every((c) => c.status === "cancelled")).toBe(true);
    const status = await service.readAdminDispatch(identity(admin), requestId, "status");
    expect(status).toMatchObject({ reason_codes: expect.arrayContaining(["retry_limit_reached"]), next_action_codes: ["cancel_request"] });
    expect(before.outboxEvents.filter((e) => e.topic === "admin.dispatch.retry")).toHaveLength(3);
    expect(before.notifications.filter((n) => n.type === "dispatch.search.retried")).toHaveLength(3);
    expect(before.notifications.filter((n) => n.userId === mechanic)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "dispatch.offer", body: "Mở yêu cầu và kiểm tra thông tin trước khi nhận việc." })]));
    for (const event of before.outboxEvents.filter((e) => e.topic.startsWith("admin.dispatch."))) await expect(deliverOutboxEvent(event)).resolves.toBeUndefined();
    expect(JSON.stringify(before.outboxEvents)).not.toContain(reason.reason);
  });

  it("protects all reads/commands and requires valid reason, key, UUID and query", async () => {
    const uow = fixture(); const service = new DispatchService(uow, { now: () => now });
    for (const subject of [rider, mechanic]) {
      for (const view of ["status", "rounds", "eligible", "explanation"] as const) await expect(service.readAdminDispatch(identity(subject), requestId, view)).rejects.toMatchObject({ status: 403 });
      await expect(service.readAdminRound(identity(subject), uow.snapshot().dispatchRounds[0]!.id)).rejects.toMatchObject({ status: 403 });
      for (const action of ["retry", "cancel", "expire"] as const) await expect(service.commandAdminDispatch(identity(subject), requestId, action, reason, "valid-admin-key")).rejects.toMatchObject({ status: 403 });
    }
    const routes = createAdminDispatchRouteHandlers({ authenticate: async () => identity(admin), service });
    const req = (body: string, key = "valid-admin-key") => new Request("http://localhost/api/v1/admin/service-requests/x/dispatch/retry", { method: "POST", body, headers: { "x-idempotency-key": key } });
    expect((await routes.command(req("{}"), requestId, "retry")).status).toBe(400);
    expect((await routes.command(req("bad-json"), requestId, "retry")).status).toBe(400);
    expect((await routes.command(req(JSON.stringify(reason), "short"), requestId, "retry")).status).toBe(400);
    expect((await routes.read(new Request("http://localhost/?limit=101"), requestId, "explanation")).status).toBe(400);
    expect((await routes.read(new Request("http://localhost/?cursor=bad"), requestId, "rounds")).status).toBe(400);
    expect((await routes.command(req(JSON.stringify(reason)), "bad", "retry")).status).toBe(400);
    expect((await routes.command(req(JSON.stringify(reason)), requestId, "retry")).status).toBe(202);
  });

  it("expires only overdue unleased rounds and leaves a real manual-escalation retry path", async () => {
    let clock = now; const uow = fixture(); const service = new DispatchService(uow, { now: () => clock });
    const result = await service.commandAdminDispatch(identity(admin), requestId, "retry", reason, "retry-expire-test");
    const round = result.round as { id: string };
    await expect(service.commandAdminDispatch(identity(admin), round.id, "expire", reason, "too-early-expire")).rejects.toMatchObject({ status: 409 });
    clock = new Date(now.getTime() + 61_000);
    await service.commandAdminDispatch(identity(admin), round.id, "expire", reason, "overdue-expire-test");
    expect(await service.readAdminRound(identity(admin), round.id)).toMatchObject({ status: "expired", candidates: [expect.objectContaining({ status: "expired" })] });
    expect(await service.readAdminDispatch(identity(admin), requestId, "status")).toMatchObject({ request_status: "manual_escalation", next_action_codes: expect.arrayContaining(["retry_dispatch"]) });
    const state = fixture().snapshot(); state.dispatchRounds[3]!.status = "active"; state.dispatchRounds[3]!.leaseOwner = "worker";
    state.dispatchRounds[3]!.leaseExpiresAt = new Date(now.getTime() + 60_000);
    const leased = new InMemoryUnitOfWork(state); const before = leased.snapshot();
    await expect(new DispatchService(leased, { now: () => now }).commandAdminDispatch(identity(admin), requestId, "retry", reason, "leased-retry-test")).rejects.toMatchObject({ status: 409 });
    expect(leased.snapshot()).toEqual(before);
  });

  it("returns multiple exclusion reasons, bounded stable pages and redacted data", async () => {
    const state = fixture().snapshot(); const blocked = randomUUID();
    state.users.push({ id: blocked, displayName: "Private mechanic name", status: "suspended", createdAt: now, updatedAt: now });
    state.mechanicProfiles.push({ ...state.mechanicProfiles[0]!, userId: blocked, profileStatus: "pending", isAvailable: false,
      serviceTypes: [], latestLocation: { latitude: 11, longitude: 106.69 }, locationUpdatedAt: new Date(now.getTime() - 600_000) });
    state.assignments.push({ id: randomUUID(), requestId: randomUUID(), mechanicId: blocked, acceptedCandidateId: randomUUID(), status: "accepted",
      reservationStartAt: now, reservationEndAt: new Date(now.getTime() + 60_000), acceptedAt: now, createdAt: now, updatedAt: now });
    const service = new DispatchService(new InMemoryUnitOfWork(state), { now: () => now });
    const explanation = await service.readAdminDispatch(identity(admin), requestId, "explanation");
    expect(explanation).toMatchObject({ reason_counts_scope: "page", items: expect.arrayContaining([expect.objectContaining({ mechanic_id: blocked,
      reason_codes: ["user_inactive", "mechanic_role_missing", "profile_inactive", "unavailable", "skill_mismatch", "location_stale", "outside_radius", "current_work", "reservation_conflict"] })]) });
    expect(JSON.stringify(explanation)).not.toMatch(/Private|latitude|longitude|latest_location|lease_owner|problem_description/);
    const first = await service.readAdminDispatch(identity(admin), requestId, "explanation", { limit: 1 });
    if (!("page" in first) || !("items" in first)) throw new Error("Missing page");
    const second = await service.readAdminDispatch(identity(admin), requestId, "explanation", { limit: 1, cursor: first.page.next_cursor });
    const firstItem = first.items[0]!;
    if (!("mechanic_id" in firstItem)) throw new Error("Missing mechanic");
    expect(second).toMatchObject({ page: { has_more: false }, items: [expect.objectContaining({ mechanic_id: firstItem.mechanic_id === mechanic ? blocked : mechanic })] });
    expect(await service.readAdminDispatch(identity(admin), requestId, "eligible")).toMatchObject({ items: [expect.objectContaining({ mechanic_id: mechanic, eligible: true })] });
  });
});
