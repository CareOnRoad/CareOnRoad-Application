import { describe, expect, it } from "vitest";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AssignmentService } from "@/features/assignments/assignment.service";
import { MechanicAssignmentMetadataService } from "@/features/mechanic-operations/mechanic-assignment-metadata.service";
import { createMechanicOperationsRouteHandlers } from "@/features/mechanic-operations/mechanic-operations.route-handlers";
import { PaymentService } from "@/features/payments/payment.service";
import type { PaymentProviderClient, VerifiedPaymentEvent } from "@/features/payments/payment-provider";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { QuoteService } from "../quote.service";

const rider = "11111111-1111-4111-8111-111111111111";
const mechanic = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";
const assignmentId = "55555555-5555-4555-8555-555555555555";
const identity = (subject: string): VerifiedSupabaseIdentity => ({ subject, issuer: "https://example.test/auth/v1", audience: ["authenticated"] });
const line = (description: string, amount: number, type = "part") => ({ line_type: type, description, quantity: 1, unit_amount: amount });
const laborInput = { assignment_id: assignmentId, purpose: "maintenance_labor", lines: [line("Công bảo dưỡng", 100_000, "labor")] };
const workInput = { assignment_id: assignmentId, purpose: "maintenance_work", lines: [line("Dầu", 120_000), line("Lọc gió", 50_000)] };
const checklistInput = { work_summary: "Đã thực hiện các hạng mục bảo dưỡng đã được duyệt.", safety_checklist: {
  test_ride_completed: true, tools_removed: true, area_safe: true, rider_briefed: true, no_fluid_leak: true
} };

function setup() {
  let time = new Date("2026-10-01T09:00:00Z");
  const now = () => new Date(time);
  const tick = () => { time = new Date(time.getTime() + 1000); };
  const uow = new InMemoryUnitOfWork({
    users: [rider, mechanic, outsider].map((id) => ({ id, status: "active", createdAt: now(), updatedAt: now() })),
    userRoles: [{ userId: rider, role: "rider" }, { userId: mechanic, role: "mechanic" }, { userId: outsider, role: "rider" }],
    serviceRequests: [{ id: requestId, requestCode: "COR-MNT-20261001-1", riderId: rider, motorcycleId: "88888888-8888-4888-8888-888888888888",
      serviceType: "periodic_maintenance", scheduledStartAt: new Date(time.getTime() + 3600_000), problemDescription: "Bảo dưỡng định kỳ",
      status: "assigned", priority: "normal", createdAt: now(), updatedAt: now() }],
    assignments: [{ id: assignmentId, requestId, mechanicId: mechanic, acceptedCandidateId: "77777777-7777-4777-8777-777777777777",
      status: "accepted", acceptedAt: now(), createdAt: now(), updatedAt: now() }]
  });
  let event: VerifiedPaymentEvent = { kind: "invalid", reason: "test" };
  const provider: PaymentProviderClient = {
    async createPaymentLink(input) { return { paymentLinkId: `link-${input.orderCode}`, checkoutUrl: "https://example.test/pay", status: "PENDING" }; },
    async cancelPaymentLink(input) { return { orderCode: input.orderCode, amount: 270_000, amountPaid: 0, currency: "VND", status: "CANCELLED" }; },
    async getPaymentStatus(orderCode) { return { orderCode, paymentLinkId: `link-${orderCode}`, amount: 270_000, amountPaid: 270_000, currency: "VND", status: "PAID" }; },
    verifyWebhookPayload() { return event; }
  };
  const quotes = new QuoteService(uow, { now });
  const assignments = new AssignmentService(uow, { now });
  const metadata = new MechanicAssignmentMetadataService(uow, { now });
  const payments = new PaymentService(uow, { now, providerFactory: () => provider, returnUrl: () => "https://example.test/return", cancelUrl: () => "https://example.test/cancel" });
  const status = (value: string) => assignments.transitionAssignment(identity(mechanic), assignmentId, { status: value });
  async function agreeLabor() {
    const labor = await quotes.createQuote(identity(mechanic), requestId, laborInput);
    await quotes.approveQuote(identity(rider), labor.id);
    return labor;
  }
  async function arrive() { for (const value of ["en_route", "on_site", "diagnosis"]) await status(value); }
  async function start(parts = workInput.lines) {
    await agreeLabor(); await arrive();
    const work = await quotes.createQuote(identity(mechanic), requestId, { ...workInput, lines: parts });
    await quotes.approveQuote(identity(rider), work.id);
    await status("in_progress");
    return work;
  }
  async function checklist(key = "maintenance-checklist") { return metadata.submitCompletionChecklist(identity(mechanic), assignmentId, checklistInput, key); }
  async function finish() { tick(); await checklist(`maintenance-finish-${time.toISOString()}`); await status("awaiting_payment"); }
  async function receive(quoteId: string, key = "maintenance-payment", difference = 0) {
    const order = await payments.createPaymentOrder(identity(rider), { quote_id: quoteId }, key);
    event = { kind: "valid", eventDedupeKey: order.id, success: true, orderCode: order.provider_order_code, amount: order.amount + difference,
      currency: "VND", paymentLinkId: order.provider_payment_link_id, status: "00" };
    const result = await payments.handlePayosWebhook({});
    return { order, result };
  }
  return { uow, quotes, assignments, payments, metadata, status, agreeLabor, arrive, start, checklist, finish, receive, tick };
}

describe("maintenance approval, additions and after-service payment", () => {
  it("requires positive itemized labor consent before travel and freezes the agreement", async () => {
    const s = setup();
    await expect(s.status("en_route")).rejects.toMatchObject({ status: 409 });
    await expect(s.quotes.createQuote(identity(outsider), requestId, laborInput)).rejects.toMatchObject({ status: 403 });
    await expect(s.quotes.createQuote(identity(mechanic), requestId, { ...laborInput, lines: [line("Công", 0, "labor")] })).rejects.toMatchObject({ status: 400 });
    await expect(s.quotes.createQuote(identity(mechanic), requestId, { ...laborInput, lines: [...laborInput.lines, line("Dầu", 120_000)] })).rejects.toMatchObject({ status: 400 });
    await expect(s.quotes.createQuote(identity(mechanic), requestId, { ...workInput, purpose: "standard" })).rejects.toMatchObject({ status: 400 });
    const labor = await s.quotes.createQuote(identity(mechanic), requestId, { ...laborInput, lines: [...laborInput.lines, line("Đi lại", 20_000, "other")] });
    await expect(s.quotes.approveQuote(identity(outsider), labor.id)).rejects.toMatchObject({ status: 403 });
    await expect(s.quotes.approveQuote(identity(rider), labor.id, { payment_timing: "labor_upfront" })).rejects.toMatchObject({ status: 400 });
    await s.quotes.approveQuote(identity(rider), labor.id);
    expect(s.uow.snapshot().assignments[0]?.maintenanceLaborQuoteId).toBe(labor.id);
    expect(await s.payments.getPaymentSummary(identity(rider), requestId)).toMatchObject({ payment_timing: "after_service", labor_amount: 100_000, other_amount: 20_000, total_amount: 120_000 });
    await expect(s.quotes.createQuote(identity(mechanic), requestId, laborInput)).rejects.toMatchObject({ status: 409 });
    await expect(s.payments.createPaymentOrder(identity(rider), { quote_id: labor.id }, "early-maintenance-labor")).rejects.toMatchObject({ status: 409 });
    await s.status("en_route");
  });

  it("requires parts approval, checklist and full verified payment before completion", async () => {
    const s = setup(); await s.agreeLabor(); await s.arrive();
    const work = await s.quotes.createQuote(identity(mechanic), requestId, workInput);
    expect(work.total_amount).toBe(270_000);
    await expect(s.status("in_progress")).rejects.toMatchObject({ status: 409 });
    await expect(s.checklist()).rejects.toMatchObject({ status: 409 });
    await s.quotes.approveQuote(identity(rider), work.id);
    await s.status("in_progress");
    await expect(s.payments.createPaymentOrder(identity(rider), { quote_id: work.id }, "early-maintenance-work")).rejects.toMatchObject({ status: 409 });
    await expect(s.status("completed")).rejects.toMatchObject({ status: 409 });
    await expect(s.status("awaiting_payment")).rejects.toMatchObject({ status: 409 });
    await s.finish();
    await expect(s.status("completed")).rejects.toMatchObject({ status: 409 });
    const { order, result } = await s.receive(work.id);
    expect(result.status).toBe("succeeded");
    expect((await s.payments.createPaymentOrder(identity(rider), { quote_id: work.id }, "maintenance-payment")).id).toBe(order.id);
    expect((await s.payments.handlePayosWebhook({})).status).toBe("duplicate");
    expect(s.uow.snapshot().assignments[0]?.status).toBe("awaiting_payment");
    await s.status("completed");
    expect(s.uow.snapshot().serviceRequests[0]?.status).toBe("completed");
    expect(await s.payments.getPaymentSummary(identity(rider), requestId)).toMatchObject({ labor_amount: 100_000, parts_amount: 170_000, total_amount: 270_000, paid_amount: 270_000, remaining_amount: 0 });
    expect(s.uow.snapshot().paymentOrders).toHaveLength(1);
    await expect(s.payments.createPaymentOrder(identity(rider), { quote_id: work.id }, "collect-twice-maintenance")).rejects.toMatchObject({ status: 409 });
    expect(s.uow.snapshot().notifications.filter((n) => n.type === "payment.succeeded").map((n) => n.userId)).toEqual([rider, mechanic]);
  });

  it("adds new items to approved work, rejects stale bases and waits for consent", async () => {
    const s = setup(); const work = await s.start();
    const input = { ...workInput, basis_quote_id: work.id, lines: [line("Vệ sinh bổ sung", 30_000, "labor"), line("Bugi", 40_000)] };
    await expect(s.quotes.createQuote(identity(mechanic), requestId, { ...input, basis_quote_id: assignmentId })).rejects.toMatchObject({ status: 409 });
    const extra = await s.quotes.createQuote(identity(mechanic), requestId, input);
    expect(extra.total_amount).toBe(340_000);
    expect(extra.lines.slice(0, work.lines.length).map((l) => [l.description, l.unit_amount])).toEqual(work.lines.map((l) => [l.description, l.unit_amount]));
    expect(await s.payments.getPaymentSummary(identity(rider), requestId)).toMatchObject({ total_amount: 270_000, pending_quote_id: extra.id });
    await expect(s.finish()).rejects.toMatchObject({ status: 409 });
    await s.quotes.approveQuote(identity(rider), extra.id);
    await expect(s.quotes.createQuote(identity(mechanic), requestId, input)).rejects.toMatchObject({ status: 409 });
    await s.finish(); await s.receive(extra.id); await s.status("completed");
    expect((await s.payments.getPaymentSummary(identity(rider), requestId)).total_amount).toBe(340_000);
  });

  it("continues and collects the previously approved scope when an addition is rejected", async () => {
    const s = setup(); const work = await s.start([line("Dầu", 120_000)]);
    const extra = await s.quotes.createQuote(identity(mechanic), requestId, { ...workInput, basis_quote_id: work.id, lines: [line("Lọc gió", 50_000)] });
    await s.quotes.rejectQuote(identity(rider), extra.id);
    expect(s.uow.snapshot().assignments[0]?.status).toBe("in_progress");
    expect(await s.payments.getPaymentSummary(identity(rider), requestId)).toMatchObject({ quote_id: work.id, total_amount: 220_000 });
    await s.finish();
    await expect(s.payments.createPaymentOrder(identity(rider), { quote_id: extra.id }, "rejected-maintenance-order")).rejects.toMatchObject({ status: 409 });
    expect((await s.receive(work.id)).order.amount).toBe(220_000);
    await s.status("completed");
  });

  it("revises rejected initial parts and cannot overwrite agreed labor or change the bill after finishing", async () => {
    const s = setup(); await s.agreeLabor(); await s.arrive();
    const rejected = await s.quotes.createQuote(identity(mechanic), requestId, workInput);
    await s.quotes.rejectQuote(identity(rider), rejected.id);
    await expect(s.status("in_progress")).rejects.toMatchObject({ status: 409 });
    await expect(s.quotes.createQuote(identity(mechanic), requestId, { ...workInput, lines: [line("Công mới", 1, "labor")] })).rejects.toMatchObject({ status: 400 });
    const work = await s.quotes.createQuote(identity(mechanic), requestId, { ...workInput, lines: [] });
    await s.quotes.approveQuote(identity(rider), work.id); await s.status("in_progress"); await s.finish();
    expect((await s.receive(work.id)).order.amount).toBe(100_000);
    await expect(s.quotes.createQuote(identity(mechanic), requestId, { ...workInput, basis_quote_id: work.id })).rejects.toMatchObject({ status: 400 });
    await s.status("completed");
  });

  it("requires a fresh checklist after approved additions and restricts checklist reads", async () => {
    const s = setup(); const work = await s.start(); await s.checklist();
    const extra = await s.quotes.createQuote(identity(mechanic), requestId, { ...workInput, basis_quote_id: work.id, lines: [line("Bugi", 40_000)] });
    await s.quotes.approveQuote(identity(rider), extra.id);
    await expect(s.status("awaiting_payment")).rejects.toMatchObject({ status: 409 });
    await s.checklist("fresh-maintenance-checklist"); await s.status("awaiting_payment");
    expect(await s.metadata.getCompletionChecklist(identity(rider), assignmentId)).toMatchObject({ revision: 2, approved_quote_id: extra.id, work_summary: checklistInput.work_summary });
    await expect(s.metadata.getCompletionChecklist(identity(outsider), assignmentId)).rejects.toMatchObject({ status: 403 });
    await expect(s.metadata.getCompletionChecklist(identity(rider), "invalid")).rejects.toMatchObject({ status: 400 });
    const handlers = createMechanicOperationsRouteHandlers({ authenticate: async () => identity(rider), completionChecklistService: s.metadata,
      dashboardService: { async getDashboard() { throw Error("unused"); } }, jobListService: { async listJobs() { throw Error("unused"); } }, performanceService: { async getPerformance() { throw Error("unused"); } } });
    expect((await handlers.getCompletionChecklist(new Request("http://localhost/checklist"), assignmentId)).status).toBe(200);
  });

  it("supersedes pending additions and cannot approve expired or older versions", async () => {
    const s = setup(); const work = await s.start();
    const input = { ...workInput, basis_quote_id: work.id, lines: [line("Bugi", 40_000)] };
    const old = await s.quotes.createQuote(identity(mechanic), requestId, input);
    const current = await s.quotes.createQuote(identity(mechanic), requestId, { ...input, expires_at: "2026-10-01T09:00:01Z" });
    await expect(s.quotes.approveQuote(identity(rider), old.id)).rejects.toMatchObject({ status: 409 });
    s.tick(); s.tick();
    await expect(s.quotes.approveQuote(identity(rider), current.id)).rejects.toMatchObject({ status: 409 });
    await s.quotes.rejectQuote(identity(rider), current.id); await s.finish();
    expect((await s.receive(work.id)).order.amount).toBe(270_000);
  });

  it("holds an incorrect payment for review and prevents closing or collecting it again", async () => {
    const s = setup(); const work = await s.start(); await s.finish();
    expect((await s.receive(work.id, "short-maintenance-payment", -1)).result.status).toBe("needs_review");
    await expect(s.status("completed")).rejects.toMatchObject({ status: 409 });
    await expect(s.payments.createPaymentOrder(identity(rider), { quote_id: work.id }, "repeat-reviewed-maintenance")).rejects.toMatchObject({ status: 409 });
  });

  it("preserves the payment prerequisite for legacy standard maintenance jobs", async () => {
    const s = setup(); const state = s.uow.snapshot();
    state.assignments[0]!.status = "awaiting_payment"; state.serviceRequests[0]!.status = "awaiting_payment";
    state.quotes.push({ id: "99999999-9999-4999-8999-999999999999", assignmentId, requestId, version: 1, purpose: "standard", status: "approved", currency: "VND",
      subtotalAmount: 100_000, discountAmount: 0, totalAmount: 100_000, createdBy: mechanic, createdAt: new Date(), lines: [] });
    const legacy = new InMemoryUnitOfWork(state); const assignments = new AssignmentService(legacy);
    await expect(assignments.transitionAssignment(identity(mechanic), assignmentId, { status: "in_progress" })).rejects.toMatchObject({ status: 409 });
  });
});
