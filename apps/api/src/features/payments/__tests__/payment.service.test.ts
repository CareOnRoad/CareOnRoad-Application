import { describe, expect, it, vi } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { AssignmentService } from "@/features/assignments/assignment.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import type {
  CreateProviderPaymentInput,
  PaymentProviderClient,
  ProviderPaymentLink,
  ProviderPaymentStatus,
  VerifiedPaymentEvent
} from "../payment-provider";
import { PaymentService } from "../payment.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const mechanicId = "22222222-2222-4222-8222-222222222222";
const otherRiderId = "33333333-3333-4333-8333-333333333333";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const assignmentId = "66666666-6666-4666-8666-666666666666";
const quoteId = "77777777-7777-4777-8777-777777777777";
const now = new Date("2026-07-08T03:00:00.000Z");

describe("payment service", () => {
  it("holds signed non-VND receipts for review without crediting or labeling them VND", async () => {
    const provider = new FakeProvider();
    const unitOfWork = createUnitOfWork();
    const service = createPaymentService(unitOfWork, provider);
    const order = await service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "currency-review-order");
    provider.nextWebhook = { kind: "valid", eventDedupeKey: "currency-mismatch", success: true,
      orderCode: order.provider_order_code, amount: order.amount, currency: "USD", status: "00" };
    expect(await service.handlePayosWebhook({})).toMatchObject({ status: "needs_review" });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.paymentOrders[0]?.status).toBe("needs_review");
    expect(snapshot.paymentEvents[0]).toMatchObject({ eventType: "payment_currency_mismatch", signatureValid: true });
    expect(snapshot.paymentEvents[0]?.currency).toBeUndefined();
    expect(snapshot.assignments[0]?.status).toBe("awaiting_payment");
  });
  it("holds a verified payment for a canceled job for investigation", async () => {
    const provider = new FakeProvider();
    const state = createUnitOfWork().snapshot();
    state.serviceRequests[0]!.status = "canceled";
    state.assignments[0]!.status = "canceled";
    state.paymentOrders.push({ id: "99999999-9999-4999-8999-999999999999", quoteId, requestId, assignmentId, riderId,
      provider: "payos", providerOrderCode: 100001, amount: 150000, currency: "VND", status: "pending", description: "COR100001", createdAt: now, updatedAt: now });
    const unitOfWork = new InMemoryUnitOfWork(state);
    const service = createPaymentService(unitOfWork, provider);
    provider.nextWebhook = { kind: "valid", eventDedupeKey: "canceled-job-receipt", success: true,
      orderCode: 100001, amount: 150000, currency: "VND", status: "00" };
    expect(await service.handlePayosWebhook({})).toMatchObject({ status: "needs_review" });
    expect(unitOfWork.snapshot().paymentOrders[0]?.reviewReason).toBe("paid_for_inactive_workflow");
  });
  it("closes review only when the provider proves the terminal order received zero money", async () => {
    const provider = new FakeProvider();
    const state = createUnitOfWork().snapshot();
    state.userRoles.push({ userId: otherRiderId, role: "admin" });
    const unitOfWork = new InMemoryUnitOfWork(state);
    const service = createPaymentService(unitOfWork, provider);
    const order = await service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "unpaid-review-order");
    provider.nextWebhook = { kind: "valid", eventDedupeKey: "unpaid-mismatch", success: true,
      orderCode: order.provider_order_code, amount: 1, currency: "VND", status: "00" };
    await service.handlePayosWebhook({});
    const status = vi.spyOn(provider, "getPaymentStatus").mockResolvedValue({ orderCode: order.provider_order_code,
      paymentLinkId: order.provider_payment_link_id, amount: order.amount, amountPaid: 1, currency: "VND", status: "CANCELLED" });
    const input = { action: "close_unpaid", reason: "Verified provider cancellation" };
    await expect(service.resolvePaymentReview(identity(otherRiderId), order.id, input, "close-review-key")).rejects.toMatchObject({ status: 409 });
    status.mockResolvedValue({ orderCode: order.provider_order_code, paymentLinkId: order.provider_payment_link_id,
      amount: order.amount, amountPaid: 0, currency: "VND", status: "CANCELLED" });
    expect(await service.resolvePaymentReview(identity(otherRiderId), order.id, input, "close-review-key")).toMatchObject({ status: "canceled" });
    await expect(service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "new-after-review-key")).resolves.toMatchObject({ status: "pending" });
  });

  it("does not credit a late old payment while a replacement link is active", async () => {
    const provider = new FakeProvider();
    const state = createUnitOfWork().snapshot();
    state.userRoles.push({ userId: otherRiderId, role: "admin" });
    const unitOfWork = new InMemoryUnitOfWork(state);
    const service = createPaymentService(unitOfWork, provider);
    const old = await service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "old-replacement-key");
    await service.cancelPaymentOrder(identity(riderId), old.id);
    await service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "new-replacement-key");
    provider.nextWebhook = { kind: "valid", eventDedupeKey: "old-late-receipt", success: true,
      orderCode: old.provider_order_code, amount: old.amount, currency: "VND", status: "00" };
    await service.handlePayosWebhook({});
    vi.spyOn(provider, "getPaymentStatus").mockResolvedValue({ orderCode: old.provider_order_code,
      paymentLinkId: old.provider_payment_link_id, amount: old.amount, amountPaid: old.amount, currency: "VND", status: "PAID" });
    await expect(service.resolvePaymentReview(identity(otherRiderId), old.id,
      { action: "confirm_received", reason: "Verified old payment receipt" }, "replacement-review-key")).rejects.toMatchObject({ status: 409 });
    expect(unitOfWork.snapshot().paymentOrders.map((order) => order.status)).toEqual(["needs_review", "pending"]);
  });

  it("records a provider failure without starving the next stale order", async () => {
    const provider = new FakeProvider();
    const unitOfWork = createUnitOfWork();
    vi.spyOn(provider, "createPaymentLink").mockRejectedValue(new Error("offline"));
    const service = createPaymentService(unitOfWork, provider);
    await expect(service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "offline-worker-key")).rejects.toThrow();
    const later = new Date(now.getTime() + 180_000);
    const worker = new PaymentService(unitOfWork, { now: () => later, providerFactory: () => provider,
      returnUrl: () => "https://example.test/return", cancelUrl: () => "https://example.test/cancel" });
    expect(await worker.reconcilePendingPayments()).toMatchObject({ claimed: 1, failed: 1 });
    expect(unitOfWork.snapshot().paymentOrders[0]?.updatedAt).toEqual(later);
    expect(await worker.reconcilePendingPayments()).toMatchObject({ claimed: 0, failed: 0 });
  });
  it("keeps the order and code after a provider timeout, and retries the same durable order", async () => {
    const provider = new FakeProvider();
    const unitOfWork = createUnitOfWork();
    const service = createPaymentService(unitOfWork, provider);
    const create = vi.spyOn(provider, "createPaymentLink").mockRejectedValueOnce(new Error("timeout"));
    await expect(service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "durable-payment-key")).rejects.toThrow("timeout");
    const reserved = unitOfWork.snapshot().paymentOrders[0]!;
    expect(reserved.status).toBe("created");
    expect(unitOfWork.snapshot().idempotencyRecords[0]?.resourceId).toBe(reserved.id);
    const restored = await service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "durable-payment-key");
    expect(restored).toMatchObject({ id: reserved.id, provider_order_code: reserved.providerOrderCode, status: "pending" });
    expect(create.mock.calls.map(([input]) => input.orderCode)).toEqual([reserved.providerOrderCode, reserved.providerOrderCode]);
    expect(unitOfWork.snapshot().paymentOrders).toHaveLength(1);
  });

  it("recovers a created order through reconciliation without a client retry", async () => {
    const provider = new FakeProvider();
    const unitOfWork = createUnitOfWork();
    vi.spyOn(provider, "createPaymentLink").mockRejectedValueOnce(new Error("timeout"));
    const service = createPaymentService(unitOfWork, provider);
    await expect(service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "worker-recovery-key")).rejects.toThrow();
    const worker = new PaymentService(unitOfWork, { now: () => new Date(now.getTime() + 180_000), providerFactory: () => provider,
      returnUrl: () => "https://example.test/return", cancelUrl: () => "https://example.test/cancel" });
    expect(await worker.reconcilePendingPayments()).toMatchObject({ claimed: 1, succeeded: 1, failed: 0 });
    expect(unitOfWork.snapshot().paymentOrders).toHaveLength(1);
    expect(unitOfWork.snapshot().paymentOrders[0]?.status).toBe("succeeded");
  });

  it("preserves a webhook success received during link creation", async () => {
    const provider = new FakeProvider();
    const unitOfWork = createUnitOfWork();
    const service = createPaymentService(unitOfWork, provider);
    const original = provider.createPaymentLink.bind(provider);
    vi.spyOn(provider, "createPaymentLink").mockImplementation(async (input) => {
      provider.nextWebhook = { kind: "valid", eventDedupeKey: "early-webhook", success: true, orderCode: input.orderCode,
        amount: input.amount, currency: "VND", status: "00" };
      await service.handlePayosWebhook({});
      return original(input);
    });
    const order = await service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "early-webhook-key");
    expect(order.status).toBe("succeeded");
    expect(unitOfWork.snapshot().outboxEvents.filter((event) => event.topic === "payment.succeeded")).toHaveLength(1);
  });

  it("authorizes and idempotently resolves review only after provider confirmation", async () => {
    const provider = new FakeProvider();
    const state = createUnitOfWork().snapshot();
    state.userRoles.push({ userId: otherRiderId, role: "admin" });
    const unitOfWork = new InMemoryUnitOfWork(state);
    const service = createPaymentService(unitOfWork, provider);
    const order = await service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "admin-review-order");
    await service.cancelPaymentOrder(identity(riderId), order.id);
    provider.nextWebhook = { kind: "valid", eventDedupeKey: "late-review", success: true,
      orderCode: order.provider_order_code, amount: order.amount, currency: "VND", status: "00" };
    await service.handlePayosWebhook({});
    const input = { action: "confirm_received", reason: "Verified late receipt" };
    await expect(service.resolvePaymentReview(identity(riderId), order.id, input, "admin-review-key")).rejects.toMatchObject({ status: 403 });
    const status = vi.spyOn(provider, "getPaymentStatus").mockResolvedValue({ orderCode: order.provider_order_code,
      paymentLinkId: order.provider_payment_link_id, amount: order.amount, amountPaid: order.amount - 1, currency: "VND", status: "PAID" });
    await expect(service.resolvePaymentReview(identity(otherRiderId), order.id, input, "admin-review-key")).rejects.toMatchObject({ status: 409 });
    expect(unitOfWork.snapshot().paymentOrders[0]?.status).toBe("needs_review");
    status.mockResolvedValue({ orderCode: order.provider_order_code, paymentLinkId: order.provider_payment_link_id,
      amount: order.amount, amountPaid: order.amount, currency: "VND", status: "PAID" });
    const resolved = await service.resolvePaymentReview(identity(otherRiderId), order.id, input, "admin-review-key");
    expect(resolved.status).toBe("succeeded");
    status.mockRejectedValue(new Error("offline"));
    expect(await service.resolvePaymentReview(identity(otherRiderId), order.id, input, "admin-review-key")).toEqual(resolved);
    expect(unitOfWork.snapshot().auditLogs.filter((event) => event.action === "payment.review.resolved")).toHaveLength(1);
    expect(JSON.stringify(unitOfWork.snapshot().auditLogs)).not.toContain(input.reason);
    expect(resolved).not.toHaveProperty("checkout_url");
  });
  it("creates a payOS payment order and replays idempotently", async () => {
    const provider = new FakeProvider();
    const unitOfWork = createUnitOfWork();
    const service = createPaymentService(unitOfWork, provider);

    const created = await service.createPaymentOrder(
      identity(riderId),
      { quote_id: quoteId },
      "payment-key-1"
    );
    const replay = await service.createPaymentOrder(
      identity(riderId),
      { quote_id: quoteId },
      "payment-key-1"
    );

    expect(created).toMatchObject({
      quote_id: quoteId,
      request_id: requestId,
      assignment_id: assignmentId,
      rider_id: riderId,
      provider: "payos",
      status: "pending",
      currency: "VND",
      amount: 150000,
      checkout_url: "https://pay.payos.vn/web/link-100001",
      qr_code: "qr-100001"
    });
    expect(replay).toEqual(created);
    expect(provider.createdLinks).toHaveLength(1);
    expect(unitOfWork.snapshot().paymentOrders).toHaveLength(1);
    expect(JSON.stringify(unitOfWork.snapshot().auditLogs)).not.toContain("api");
  });

  it("allows only the owning rider to create payment orders", async () => {
    const service = createPaymentService(createUnitOfWork(), new FakeProvider());

    await expect(
      service.createPaymentOrder(identity(otherRiderId), { quote_id: quoteId }, "payment-key-2")
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      service.createPaymentOrder(identity(mechanicId), { quote_id: quoteId }, "payment-key-3")
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
  });

  it("marks succeeded from a verified webhook and then permits assignment start", async () => {
    const provider = new FakeProvider();
    const unitOfWork = createUnitOfWork();
    const payments = createPaymentService(unitOfWork, provider);
    const assignments = new AssignmentService(unitOfWork, { now: () => now });

    await expect(
      assignments.transitionAssignment(identity(mechanicId), assignmentId, {
        status: "in_progress"
      })
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });

    const order = await payments.createPaymentOrder(
      identity(riderId),
      { quote_id: quoteId },
      "payment-key-4"
    );
    provider.nextWebhook = {
      kind: "valid",
      eventDedupeKey: "TF230204212323",
      success: true,
      orderCode: order.provider_order_code,
      amount: order.amount,
      currency: "VND",
      paymentLinkId: order.provider_payment_link_id,
      providerReference: "TF230204212323",
      status: "00"
    };

    await expect(payments.handlePayosWebhook({})).resolves.toMatchObject({
      received: true,
      matched: true,
      status: "succeeded"
    });
    await expect(payments.handlePayosWebhook({})).resolves.toMatchObject({
      status: "duplicate"
    });

    const started = await assignments.transitionAssignment(identity(mechanicId), assignmentId, {
      status: "in_progress"
    });
    expect(started.status).toBe("in_progress");
    expect(unitOfWork.snapshot().paymentOrders[0]?.status).toBe("succeeded");
    expect(unitOfWork.snapshot().assignmentStatusHistory.at(-1)).toMatchObject({
      fromStatus: "awaiting_payment",
      toStatus: "in_progress"
    });
  });

  it("moves mismatched verified provider events to needs_review", async () => {
    const provider = new FakeProvider();
    const unitOfWork = createUnitOfWork();
    const service = createPaymentService(unitOfWork, provider);
    const order = await service.createPaymentOrder(
      identity(riderId),
      { quote_id: quoteId },
      "payment-key-5"
    );
    provider.nextWebhook = {
      kind: "valid",
      eventDedupeKey: "mismatch-1",
      success: true,
      orderCode: order.provider_order_code,
      amount: order.amount - 1,
      currency: "VND",
      paymentLinkId: order.provider_payment_link_id,
      providerReference: "mismatch-1",
      status: "00"
    };

    await expect(service.handlePayosWebhook({})).resolves.toMatchObject({
      status: "needs_review"
    });
    expect(unitOfWork.snapshot().paymentOrders[0]).toMatchObject({
      status: "needs_review",
      reviewReason: "provider_payment_mismatch"
    });
    await expect(service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "mismatch-retry-key")).rejects.toMatchObject({ status: 409 });
    expect(provider.createdLinks).toHaveLength(1);
  });

  it("holds payments received after cancellation for review and blocks recollection", async () => {
    const provider = new FakeProvider();
    const unitOfWork = createUnitOfWork();
    const service = createPaymentService(unitOfWork, provider);
    const order = await service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "cancel-order-key");
    await service.cancelPaymentOrder(identity(riderId), order.id);
    provider.nextWebhook = { kind: "valid", eventDedupeKey: "late-paid", success: true, orderCode: order.provider_order_code, amount: order.amount, currency: "VND", status: "00" };
    await expect(service.handlePayosWebhook({})).resolves.toMatchObject({ status: "needs_review" });
    await expect(service.createPaymentOrder(identity(riderId), { quote_id: quoteId }, "late-paid-retry-key")).rejects.toMatchObject({ status: 409 });
    expect(unitOfWork.snapshot().paymentOrders[0]).toMatchObject({ reviewReason: "paid_after_cancellation", canceledAt: undefined });
  });
});

class FakeProvider implements PaymentProviderClient {
  readonly createdLinks: CreateProviderPaymentInput[] = [];
  nextWebhook?: VerifiedPaymentEvent;

  async createPaymentLink(input: CreateProviderPaymentInput): Promise<ProviderPaymentLink> {
    this.createdLinks.push(input);
    return {
      paymentLinkId: `link-${input.orderCode}`,
      checkoutUrl: `https://pay.payos.vn/web/link-${input.orderCode}`,
      qrCode: `qr-${input.orderCode}`,
      status: "PENDING"
    };
  }

  async cancelPaymentLink(input: {
    orderCode: number;
    cancellationReason: string;
  }): Promise<ProviderPaymentStatus> {
    return {
      orderCode: input.orderCode,
      amount: 150000,
      currency: "VND",
      status: "CANCELLED"
    };
  }

  async getPaymentStatus(orderCode: number): Promise<ProviderPaymentStatus> {
    return {
      orderCode,
      amount: 150000,
      amountPaid: 150000,
      currency: "VND",
      status: "PAID"
    };
  }

  verifyWebhookPayload(): VerifiedPaymentEvent {
    return this.nextWebhook ?? { kind: "invalid", reason: "missing_fixture" };
  }
}

function createPaymentService(unitOfWork: InMemoryUnitOfWork, provider: FakeProvider) {
  return new PaymentService(unitOfWork, {
    now: () => now,
    providerFactory: () => provider,
    returnUrl: () => "https://example.test/payment/return",
    cancelUrl: () => "https://example.test/payment/cancel"
  });
}

function createUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [activeUser(riderId), activeUser(otherRiderId), activeUser(mechanicId)],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: otherRiderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" }
    ],
    motorcycles: [
      {
        id: motorcycleId,
        riderId,
        brandText: "Honda",
        modelText: "Wave",
        createdAt: now,
        updatedAt: now
      }
    ],
    serviceRequests: [
      {
        id: requestId,
        requestCode: "COR-MOB-20260708-1",
        riderId,
        motorcycleId,
        serviceType: "mobile_repair",
        problemDescription: "Xe hong.",
        status: "awaiting_payment",
        priority: "normal",
        createdAt: now,
        updatedAt: now
      }
    ],
    assignments: [
      {
        id: assignmentId,
        requestId,
        mechanicId,
        acceptedCandidateId: "88888888-8888-4888-8888-888888888888",
        status: "awaiting_payment",
        acceptedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ],
    quotes: [
      {
        id: quoteId,
        requestId,
        assignmentId,
        version: 1,
        status: "approved",
        currency: "VND",
        subtotalAmount: 150000,
        discountAmount: 0,
        totalAmount: 150000,
        createdBy: mechanicId,
        createdAt: now,
        respondedAt: now,
        lines: []
      }
    ]
  });
}

function activeUser(id: string) {
  return { id, status: "active" as const, createdAt: now, updatedAt: now };
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://careonroad.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}
