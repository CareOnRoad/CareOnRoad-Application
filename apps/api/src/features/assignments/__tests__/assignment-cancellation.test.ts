import { describe, expect, it, vi } from "vitest";
import { AssignmentService } from "../assignment.service";
import { AssignmentRecoveryService } from "../assignment-recovery.service";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import { AdminServiceRequestService } from "@/features/admin/admin-service-request.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import type { AssignmentStatus } from "@/server/repositories/contracts/assignment.repository";
import type { RequestStatus } from "@/server/repositories/contracts/service-request.repository";
import type { PaymentOrderStatus } from "@/server/repositories/contracts/payment.repository";
import type { QuoteStatus } from "@/server/repositories/contracts/quote.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

const rider = "11111111-1111-4111-8111-111111111111";
const mechanic = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";
const assignmentId = "55555555-5555-4555-8555-555555555555";
const quoteId = "66666666-6666-4666-8666-666666666666";
const now = new Date("2026-10-02T03:00:00Z");
const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"] });
const reason = { reason: "Verified administrative cancellation" };

describe("shared cancellation and recovery commitments", () => {
  it.each([
    ["accepted", "assigned"], ["en_route", "mechanic_en_route"], ["on_site", "in_service"], ["diagnosis", "in_service"]
  ] as const)("atomically cancels pre-work %s even when startedAt records travel", async (status, requestStatus) => {
    const unit = fixture(status, requestStatus);
    const state = unit.snapshot();
    if (status !== "accepted") state.assignments[0]!.startedAt = now;
    const actual = new InMemoryUnitOfWork(state);
    await new AssignmentService(actual, { now: () => now }).transitionAssignment(identity(mechanic), assignmentId, { status: "canceled" });
    expect(actual.snapshot().assignments[0]?.status).toBe("canceled");
    expect(actual.snapshot().serviceRequests[0]?.status).toBe("canceled");
    expect(actual.snapshot().assignmentStatusHistory).toHaveLength(1);
    expect(actual.snapshot().requestStatusHistory).toHaveLength(1);
  });

  it.each(["pending", "approved", "rejected", "expired", "superseded"] as QuoteStatus[])("blocks any issued current-assignment quote (%s) without side effects", async (status) => {
    const state = fixture().snapshot();
    state.quotes.push(quote(status));
    const unit = new InMemoryUnitOfWork(state);
    await expect(new AssignmentService(unit).transitionAssignment(identity(mechanic), assignmentId, { status: "canceled" }))
      .rejects.toMatchObject({ status: 409, details: { reason_code: "quote_already_issued" } });
    await expect(new AssignmentRecoveryService(unit).recover(identity(mechanic), assignmentId, { reason_code: "cannot_continue" }, "quote-recovery-key"))
      .rejects.toMatchObject({ status: 409, details: { reason_code: "quote_already_issued" } });
    expect(unit.snapshot()).toEqual(state);
  });

  it.each(["rescueLaborQuoteId", "maintenanceLaborQuoteId"] as const)("blocks post-agreement recovery without a payment (%s)", async (field) => {
    const state = fixture().snapshot();
    state.assignments[0]![field] = quoteId;
    state.assignments[0]!.rescuePaymentTiming = "after_repair";
    const unit = new InMemoryUnitOfWork(state);
    await expect(new AssignmentRecoveryService(unit).recover(identity(mechanic), assignmentId, { reason_code: "cannot_continue" }, "agreement-recovery-key"))
      .rejects.toMatchObject({ status: 409, details: { reason_code: "agreement_exists" } });
    expect(unit.snapshot()).toEqual(state);
  });

  it.each(["created", "pending", "succeeded", "needs_review"] as PaymentOrderStatus[])("blocks %s money even without an active assignment", async (status) => {
    const state = fixture("canceled", "manual_escalation").snapshot();
    state.paymentOrders.push({ id: quoteId, quoteId, requestId, assignmentId, riderId: rider, provider: "payos", providerOrderCode: 99,
      amount: 100000, currency: "VND", description: "COR99", status, createdAt: now, updatedAt: now });
    const unit = new InMemoryUnitOfWork(state);
    await expect(new ServiceRequestService(unit).cancelServiceRequest(identity(rider), requestId, reason))
      .rejects.toMatchObject({ status: 409, details: { reason_code: "payment_unresolved" } });
    await expect(new AdminServiceRequestService(unit).cancel(identity(admin), requestId, reason, "old-money-cancel-key"))
      .rejects.toMatchObject({ status: 409, details: { reason_code: "payment_unresolved" } });
    expect(unit.snapshot()).toEqual(state);
  });

  it("ignores quotes from a previous assignment during valid recovery and replays once", async () => {
    const state = fixture().snapshot();
    state.quotes.push({ ...quote("rejected"), assignmentId: quoteId });
    const unit = new InMemoryUnitOfWork(state);
    const service = new AssignmentRecoveryService(unit, { now: () => now });
    const args = [identity(mechanic), assignmentId, { reason_code: "cannot_continue" }, "old-quote-recovery-key"] as const;
    expect(await service.recover(...args)).toEqual(await service.recover(...args));
    expect(unit.snapshot().outboxEvents).toHaveLength(1);
  });

  it("lets the rider cancel an accepted reservation and manual escalation but blocks travel", async () => {
    const state = fixture().snapshot();
    Object.assign(state.assignments[0]!, { scheduledStartAt: now, reservationStartAt: now, reservationEndAt: new Date(now.getTime() + 3600000) });
    const unit = new InMemoryUnitOfWork(state);
    await new ServiceRequestService(unit).cancelServiceRequest(identity(rider), requestId, reason);
    expect(unit.snapshot().assignments[0]?.status).toBe("canceled");
    expect(await unit.execute(({ assignments }) => assignments.findReservationConflict({ mechanicId: mechanic, start: now, end: new Date(now.getTime() + 1000) }))).toBeUndefined();
    const escalated = fixture("canceled", "manual_escalation");
    expect(await new ServiceRequestService(escalated).cancelServiceRequest(identity(rider), requestId, reason)).toMatchObject({ status: "canceled" });
    await expect(new ServiceRequestService(fixture("en_route", "mechanic_en_route")).cancelServiceRequest(identity(rider), requestId, reason)).rejects.toMatchObject({ status: 409 });
  });

  it.each(["missing", "invalid_state", "update_failure"])("rolls back assignment/history/outbox if request synchronization fails (%s)", async (failure) => {
    const state = fixture().snapshot();
    if (failure === "missing") state.serviceRequests = [];
    if (failure === "invalid_state") state.serviceRequests[0]!.status = "awaiting_payment";
    const unit = new InMemoryUnitOfWork(state);
    const wrapper: UnitOfWork = { execute: (work) => unit.execute((repos) => {
      if (failure === "update_failure") vi.spyOn(repos.serviceRequests, "updateStatus").mockResolvedValue(undefined);
      return work(repos);
    }) };
    await expect(new AssignmentService(wrapper).transitionAssignment(identity(mechanic), assignmentId, { status: "canceled" })).rejects.toMatchObject({ status: 409 });
    expect(unit.snapshot()).toEqual(state);
  });

  it.each(["in_progress", "completed", "awaiting_payment"] as AssignmentStatus[])("does not directly cancel work from %s", async (status) => {
    const unit = fixture(status, "in_service");
    const before = unit.snapshot();
    await expect(new AssignmentService(unit).transitionAssignment(identity(mechanic), assignmentId, { status: "canceled" })).rejects.toMatchObject({ status: 409 });
    expect(unit.snapshot()).toEqual(before);
  });

  it("repairs a proved legacy cancellation only after a read-only preview, then replays the audited command", async () => {
    const state = fixture("canceled", "mechanic_en_route").snapshot();
    state.assignments[0]!.canceledAt = now;
    state.assignmentStatusHistory.push({ id: quoteId, assignmentId, fromStatus: "en_route", toStatus: "canceled", createdAt: now });
    const unit = new InMemoryUnitOfWork(state);
    const service = new AdminServiceRequestService(unit, { now: () => now });
    const input = { ...reason, assignment_id: assignmentId };
    expect(await service.repairCancellation(identity(admin), requestId, input, "repair-preview-key")).toMatchObject({ dry_run: true, repairable: true });
    expect(unit.snapshot()).toEqual(state);
    const commit = { ...input, dry_run: false };
    expect(await service.repairCancellation(identity(admin), requestId, commit, "repair-commit-key"))
      .toEqual(await service.repairCancellation(identity(admin), requestId, commit, "repair-commit-key"));
    expect(unit.snapshot().serviceRequests[0]?.status).toBe("canceled");
    expect(unit.snapshot().auditLogs).toHaveLength(1);
  });

  it("reports insufficient legacy history without writing and rejects execution", async () => {
    const unit = fixture("canceled", "assigned");
    const before = unit.snapshot();
    const service = new AdminServiceRequestService(unit);
    const input = { ...reason, assignment_id: assignmentId };
    expect(await service.repairCancellation(identity(admin), requestId, input, "repair-missing-history"))
      .toMatchObject({ dry_run: true, repairable: false, reason_code: "history_insufficient" });
    await expect(service.repairCancellation(identity(admin), requestId, { ...input, dry_run: false }, "repair-missing-history"))
      .rejects.toMatchObject({ status: 409, details: { reason_code: "history_insufficient" } });
    expect(unit.snapshot()).toEqual(before);
  });
});

function fixture(status: AssignmentStatus = "accepted", requestStatus: RequestStatus = "assigned") {
  return new InMemoryUnitOfWork({
    users: [rider, mechanic, admin].map((id) => ({ id, status: "active", createdAt: now, updatedAt: now })),
    userRoles: [{ userId: rider, role: "rider" }, { userId: mechanic, role: "mechanic" }, { userId: admin, role: "admin" }],
    serviceRequests: [{ id: requestId, riderId: rider, motorcycleId: quoteId, requestCode: "COR-MOB-20261002-1", serviceType: "mobile_repair",
      status: requestStatus, priority: "normal", problemDescription: "private", serviceLocation: { latitude: 10.76, longitude: 106.66 }, createdAt: now, updatedAt: now }],
    assignments: [{ id: assignmentId, requestId, mechanicId: mechanic, acceptedCandidateId: quoteId, status, acceptedAt: now, createdAt: now, updatedAt: now }]
  });
}

function quote(status: QuoteStatus) {
  return { id: quoteId, requestId, assignmentId, status, version: 1, currency: "VND" as const,
    subtotalAmount: 100000, discountAmount: 0, totalAmount: 100000, createdBy: mechanic, createdAt: now, lines: [] };
}
