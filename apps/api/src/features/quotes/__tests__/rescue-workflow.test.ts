import { describe, expect, it } from "vitest";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AssignmentService } from "@/features/assignments/assignment.service";
import { AcceptAssignmentService } from "@/features/assignments/accept-assignment.service";
import { DispatchService } from "@/features/dispatch/dispatch.service";
import { PaymentService } from "@/features/payments/payment.service";
import type { PaymentProviderClient, VerifiedPaymentEvent } from "@/features/payments/payment-provider";
import { createDiagnosisQuoteRouteHandlers } from "../diagnosis-quote.route-handlers";
import { createPaymentRouteHandlers } from "@/features/payments/payment.route-handlers";
import { createDispatchRouteHandlers } from "@/features/dispatch/dispatch.route-handlers";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { QuoteService } from "../quote.service";

const rider = "11111111-1111-4111-8111-111111111111";
const mechanic = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const request = "44444444-4444-4444-8444-444444444444";
const assignment = "55555555-5555-4555-8555-555555555555";
const round = "66666666-6666-4666-8666-666666666666";
const candidate = "77777777-7777-4777-8777-777777777777";
const now = new Date("2026-09-30T16:00:00Z");
const identity = (subject: string): VerifiedSupabaseIdentity => ({ subject, issuer: "https://example.test/auth/v1", audience: ["authenticated"] });
const laborInput = { assignment_id: assignment, purpose: "rescue_labor", labor_pricing: { base_amount: 100_000, distance_amount: 20_000, weather_amount: 10_000, time_amount: 30_000, weather: "rain" } };

function setup() {
  const profile = (userId: string, longitude: number) => ({ userId, profileStatus: "active" as const, isAvailable: true, serviceRadiusKm: 12,
    latestLocation: { latitude: 10, longitude }, locationUpdatedAt: now, availabilityUpdatedAt: now, ratingAvg: 5, ratingCount: 1,
    serviceTypes: ["emergency_rescue" as const], createdAt: now, updatedAt: now });
  const uow = new InMemoryUnitOfWork({
    users: [rider, mechanic, other].map((id) => ({ id, status: "active", createdAt: now, updatedAt: now })),
    userRoles: [{ userId: rider, role: "rider" }, { userId: mechanic, role: "mechanic" }, { userId: other, role: "mechanic" }],
    mechanicProfiles: [profile(mechanic, 10.005), profile(other, 10.002)],
    serviceRequests: [{ id: request, requestCode: "COR-RES-20260930-1", riderId: rider, motorcycleId: "88888888-8888-4888-8888-888888888888", serviceType: "emergency_rescue", problemDescription: "Xe hỏng", serviceLocation: { latitude: 10, longitude: 10 }, status: "assigned", priority: "normal", createdAt: now, updatedAt: now }],
    assignments: [{ id: assignment, requestId: request, mechanicId: mechanic, acceptedCandidateId: candidate, status: "accepted", acceptedAt: now, createdAt: now, updatedAt: now }],
    dispatchRounds: [{ id: round, requestId: request, roundNumber: 1, radiusMeters: 2000, status: "accepted", startedAt: now, expiresAt: new Date(now.getTime() + 60_000) }],
    dispatchCandidates: [{ id: candidate, roundId: round, requestId: request, mechanicId: mechanic, rank: 1, distanceMeters: 550, status: "accepted", offeredAt: now, expiresAt: new Date(now.getTime() + 60_000), createdAt: now },
      { id: "99999999-9999-4999-8999-999999999999", roundId: round, requestId: request, mechanicId: other, rank: 2, distanceMeters: 220, status: "cancelled", offeredAt: now, expiresAt: new Date(now.getTime() + 60_000), createdAt: now }]
  });
  let event: VerifiedPaymentEvent = { kind: "invalid", reason: "test" };
  const provider: PaymentProviderClient = {
    async createPaymentLink(input) { return { paymentLinkId: `link-${input.orderCode}`, checkoutUrl: "https://example.test/pay", qrCode: "fake-qr", status: "PENDING" }; },
    async cancelPaymentLink(input) { return { orderCode: input.orderCode, amount: 160_000, currency: "VND", status: "CANCELLED" }; },
    async getPaymentStatus(orderCode) { return { orderCode, amount: 160_000, amountPaid: 0, currency: "VND", status: "PENDING" }; },
    verifyWebhookPayload() { return event; }
  };
  const quotes = new QuoteService(uow, { now: () => now });
  const assignments = new AssignmentService(uow, { now: () => now });
  const payments = new PaymentService(uow, { now: () => now, providerFactory: () => provider, returnUrl: () => "https://example.test/return", cancelUrl: () => "https://example.test/cancel" });
  async function pay(quoteId: string, key: string) {
    const order = await payments.createPaymentOrder(identity(rider), { quote_id: quoteId }, key);
    event = { kind: "valid", eventDedupeKey: order.id, success: true, orderCode: order.provider_order_code, amount: order.amount, currency: "VND", paymentLinkId: order.provider_payment_link_id, status: "00" };
    await payments.handlePayosWebhook({});
    return order;
  }
  async function arrive() {
    for (const status of ["en_route", "on_site", "diagnosis"]) await assignments.transitionAssignment(identity(mechanic), assignment, { status });
  }
  async function repair(parts = true) {
    const final = await quotes.createQuote(identity(mechanic), request, { assignment_id: assignment, purpose: "rescue_final", lines: parts ? [{ line_type: "part", description: "Bugi", quantity: 1, unit_amount: 50_000 }] : [] });
    await quotes.approveQuote(identity(rider), final.id);
    await assignments.transitionAssignment(identity(mechanic), assignment, { status: "in_progress" });
    await assignments.transitionAssignment(identity(mechanic), assignment, { status: "awaiting_payment" });
    return final;
  }
  return { uow, provider, quotes, assignments, payments, pay, arrive, repair };
}

describe("rescue labor agreement and payment workflow", () => {
  it("requires rider consent, positive mandatory labor, and a frozen distance/weather/time breakdown before travel", async () => {
    const { quotes, assignments } = setup();
    await expect(assignments.transitionAssignment(identity(mechanic), assignment, { status: "en_route" })).rejects.toMatchObject({ status: 409 });
    await expect(quotes.createQuote(identity(other), request, laborInput)).rejects.toMatchObject({ status: 403 });
    await expect(quotes.createQuote(identity(mechanic), request, { ...laborInput, labor_pricing: { ...laborInput.labor_pricing, base_amount: 0 } })).rejects.toMatchObject({ status: 400 });
    const labor = await quotes.createQuote(identity(mechanic), request, laborInput);
    expect(labor).toMatchObject({ purpose: "rescue_labor", total_amount: 160_000, labor_pricing: { distance_m: 550, weather: "rain", time_slot: "late_night" } });
    await expect(quotes.approveQuote(identity(rider), labor.id)).rejects.toMatchObject({ status: 400 });
    await quotes.approveQuote(identity(rider), labor.id, { payment_timing: "after_repair" });
    await expect(quotes.createQuote(identity(mechanic), request, laborInput)).rejects.toMatchObject({ status: 409 });
  });

  it("collects upfront labor once and only charges the parts after repair", async () => {
    const { quotes, assignments, payments, pay, arrive, repair, uow } = setup();
    const labor = await quotes.createQuote(identity(mechanic), request, laborInput);
    await quotes.approveQuote(identity(rider), labor.id, { payment_timing: "labor_upfront" });
    await expect(assignments.transitionAssignment(identity(mechanic), assignment, { status: "en_route" })).rejects.toMatchObject({ status: 409 });
    expect((await pay(labor.id, "upfront-labor-key")).amount).toBe(160_000);
    expect(uow.snapshot().notifications).toContainEqual(expect.objectContaining({ userId: rider, type: "quote.created" }));
    expect(uow.snapshot().notifications).toContainEqual(expect.objectContaining({ userId: mechanic, type: "quote.approved" }));
    expect(uow.snapshot().notifications.filter((notification) => notification.type === "payment.succeeded").map((notification) => notification.userId)).toEqual([rider, mechanic]);
    await expect(payments.createPaymentOrder(identity(rider), { quote_id: labor.id }, "duplicate-labor-key")).rejects.toMatchObject({ status: 409 });
    await arrive();
    const final = await repair();
    expect(final.total_amount).toBe(210_000);
    await expect(assignments.transitionAssignment(identity(mechanic), assignment, { status: "completed" })).rejects.toMatchObject({ status: 409 });
    expect((await payments.getPaymentSummary(identity(rider), request))).toMatchObject({ labor_amount: 160_000, parts_amount: 50_000, paid_amount: 160_000, remaining_amount: 50_000 });
    expect((await pay(final.id, "after-repair-parts-key")).amount).toBe(50_000);
    await assignments.transitionAssignment(identity(mechanic), assignment, { status: "completed" });
    expect(uow.snapshot().serviceRequests[0]?.status).toBe("completed");
    expect(uow.snapshot().paymentOrders.map((order) => order.amount)).toEqual([160_000, 50_000]);
  });

  it("allows deferred labor and parts payment after repair and blocks unpaid completion", async () => {
    const { quotes, assignments, payments, pay, arrive, uow } = setup();
    const labor = await quotes.createQuote(identity(mechanic), request, laborInput);
    await quotes.approveQuote(identity(rider), labor.id, { payment_timing: "after_repair" });
    await expect(payments.createPaymentOrder(identity(rider), { quote_id: labor.id }, "early-labor-pay-key")).rejects.toMatchObject({ status: 409 });
    await arrive();
    const final = await quotes.createQuote(identity(mechanic), request, { assignment_id: assignment, purpose: "rescue_final", lines: [{ line_type: "part", description: "Bugi", quantity: 1, unit_amount: 50_000 }] });
    await expect(assignments.transitionAssignment(identity(mechanic), assignment, { status: "in_progress" })).rejects.toMatchObject({ status: 409 });
    await quotes.approveQuote(identity(rider), final.id);
    await expect(payments.createPaymentOrder(identity(rider), { quote_id: final.id }, "early-final-pay-key")).rejects.toMatchObject({ status: 409 });
    await assignments.transitionAssignment(identity(mechanic), assignment, { status: "in_progress" });
    await expect(assignments.transitionAssignment(identity(mechanic), assignment, { status: "completed" })).rejects.toMatchObject({ status: 409 });
    await assignments.transitionAssignment(identity(mechanic), assignment, { status: "awaiting_payment" });
    await expect(assignments.transitionAssignment(identity(mechanic), assignment, { status: "completed" })).rejects.toMatchObject({ status: 409 });
    expect(uow.snapshot().paymentOrders).toHaveLength(0);
    expect((await pay(final.id, "deferred-final-key")).amount).toBe(210_000);
    await assignments.transitionAssignment(identity(mechanic), assignment, { status: "completed" });
    expect((await payments.getPaymentSummary(identity(rider), request)).remaining_amount).toBe(0);
  });

  it("does not collect labor twice or create a zero-value payment when no parts are needed", async () => {
    const { quotes, assignments, payments, pay, arrive, repair } = setup();
    const labor = await quotes.createQuote(identity(mechanic), request, laborInput);
    await quotes.approveQuote(identity(rider), labor.id, { payment_timing: "labor_upfront" });
    await pay(labor.id, "no-parts-upfront-key");
    await arrive();
    const final = await repair(false);
    await expect(payments.createPaymentOrder(identity(rider), { quote_id: final.id }, "zero-payment-key")).rejects.toMatchObject({ status: 409 });
    await assignments.transitionAssignment(identity(mechanic), assignment, { status: "completed" });
  });

  it("rejects a mechanic, searches nearby alternatives, and recalls the old mechanic through a new invitation", async () => {
    const { quotes, uow } = setup();
    const labor = await quotes.createQuote(identity(mechanic), request, laborInput);
    await quotes.rejectQuote(identity(rider), labor.id);
    expect(uow.snapshot().assignments[0]).toMatchObject({ status: "recovery_canceled", canceledAt: now });
    expect(uow.snapshot().outboxEvents).toContainEqual(expect.objectContaining({ topic: "assignment.recovery.requested" }));
    const dispatch = new DispatchService(uow, { now: () => now });
    expect(await dispatch.restartRecoveredRequest(request)).toBe("started");
    const newOffers = uow.snapshot().dispatchCandidates.filter((offer) => offer.status === "offered");
    expect(newOffers.map((offer) => offer.mechanicId)).toEqual([other]);
    expect(uow.snapshot().notifications).toContainEqual(expect.objectContaining({ userId: other, type: "rescue.offer" }));
    await expect(dispatch.recallRescueMechanic(identity(other), request, mechanic)).rejects.toMatchObject({ status: 403 });
    const recalled = await dispatch.recallRescueMechanic(identity(rider), request, mechanic);
    expect(recalled.candidates[0]?.mechanic_id).toBe(mechanic);
    expect((await dispatch.recallRescueMechanic(identity(rider), request, mechanic)).id).toBe(recalled.id);
    const accepted = await new AcceptAssignmentService(uow, { now: () => now }).acceptOffer(identity(mechanic), recalled.candidates[0]!.id);
    const newLabor = await quotes.createQuote(identity(mechanic), request, { ...laborInput, assignment_id: accepted.id });
    expect(newLabor.version).toBe(2);
    expect(uow.snapshot().quotes.find((quote) => quote.id === labor.id)?.status).toBe("rejected");
    expect(uow.snapshot().assignments).toHaveLength(2);
  });

  it("recalls after search escalation but still rejects a stale mechanic location", async () => {
    const { quotes, uow } = setup();
    const labor = await quotes.createQuote(identity(mechanic), request, laborInput);
    await quotes.rejectQuote(identity(rider), labor.id);
    await uow.execute((repositories) => repositories.serviceRequests.updateStatus({ id: request, status: "manual_escalation", updatedAt: now }));
    const stale = new DispatchService(uow, { now: () => new Date(now.getTime() + 301_000) });
    await expect(stale.recallRescueMechanic(identity(rider), request, mechanic)).rejects.toMatchObject({ status: 409 });
    expect(uow.snapshot().serviceRequests[0]?.status).toBe("manual_escalation");
    const recalled = await new DispatchService(uow, { now: () => now }).recallRescueMechanic(identity(rider), request, mechanic);
    expect(recalled.candidates[0]?.mechanic_id).toBe(mechanic);
    expect(uow.snapshot().serviceRequests[0]?.status).toBe("offered");
  });

  it("passes payment timing through the approval API and exposes summary and recall routes", async () => {
    const { quotes, payments, uow } = setup();
    const labor = await quotes.createQuote(identity(mechanic), request, laborInput);
    const authenticate = async () => identity(rider);
    const handlers = createDiagnosisQuoteRouteHandlers({ authenticate, quoteService: quotes, diagnosisService: { async upsertDiagnosis() { throw new Error("unused"); } } });
    const approved = await handlers.approveQuote(new Request("http://localhost/approve", { method: "POST", body: JSON.stringify({ payment_timing: "after_repair" }) }), labor.id);
    expect(approved.status).toBe(200);
    const paymentHandlers = createPaymentRouteHandlers({ authenticate, authenticateWorker: () => ({ workerId: "test" }), paymentService: payments });
    const summary = await paymentHandlers.getPaymentSummary(new Request("http://localhost/summary"), request);
    expect(summary.status).toBe(200);
    await expect(summary.json()).resolves.toMatchObject({ payment_timing: "after_repair", remaining_amount: 160_000 });
    await expect(payments.getPaymentSummary(identity(other), request)).rejects.toMatchObject({ status: 403 });
    const fresh = setup();
    const rejected = await fresh.quotes.createQuote(identity(mechanic), request, laborInput);
    await fresh.quotes.rejectQuote(identity(rider), rejected.id);
    const dispatchHandlers = createDispatchRouteHandlers({ authenticate, dispatchService: new DispatchService(fresh.uow, { now: () => now }) });
    const recalled = await dispatchHandlers.recallRescueMechanic(new Request("http://localhost/recall", { method: "POST" }), request, mechanic);
    expect(recalled.status).toBe(202);
    expect(uow.snapshot().assignments[0]?.rescuePaymentTiming).toBe("after_repair");
  });

  it("keeps pending payments pending during reconciliation", async () => {
    const { quotes, payments, uow, provider } = setup();
    const labor = await quotes.createQuote(identity(mechanic), request, laborInput);
    await quotes.approveQuote(identity(rider), labor.id, { payment_timing: "labor_upfront" });
    await payments.createPaymentOrder(identity(rider), { quote_id: labor.id }, "pending-reconcile-key");
    const later = new PaymentService(uow, { now: () => new Date(now.getTime() + 180_000), providerFactory: () => provider, returnUrl: () => "https://example.test/return", cancelUrl: () => "https://example.test/cancel" });
    expect(await later.reconcilePendingPayments()).toMatchObject({ claimed: 1, still_pending: 1 });
    expect(await later.reconcilePendingPayments()).toMatchObject({ claimed: 1, still_pending: 1 });
    expect(uow.snapshot().paymentOrders[0]?.status).toBe("pending");
  });
});
