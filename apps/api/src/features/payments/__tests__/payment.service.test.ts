import { describe, expect, it } from "vitest";

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
