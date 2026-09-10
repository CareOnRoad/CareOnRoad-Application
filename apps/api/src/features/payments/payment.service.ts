import { randomUUID } from "node:crypto";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { loadActiveActor } from "@/features/assignments/assignment.service";
import { prepareIdempotency } from "@/lib/idempotency";
import type {
  PaymentEvent,
  PaymentOrder,
  PaymentOrderStatus
} from "@/server/repositories/contracts/payment.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import type { ApiErrorCode } from "@/lib/api-error";

import { createPaymentOrderInputSchema, paymentOrderIdParamSchema } from "./payment.schemas";
import type { PaymentProviderClient, ProviderPaymentStatus, VerifiedPaymentEvent } from "./payment-provider";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAYMENT_EXPIRY_MS = 30 * 60 * 1000;

export type PaymentOrderResponse = {
  id: string;
  quote_id: string;
  request_id: string;
  assignment_id: string;
  rider_id: string;
  provider: "payos";
  provider_order_code: number;
  provider_payment_link_id?: string;
  status: PaymentOrderStatus;
  currency: "VND";
  amount: number;
  checkout_url?: string;
  qr_code?: string;
  description: string;
  failure_code?: string;
  review_reason?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  succeeded_at?: string;
  canceled_at?: string;
};

export type PaymentWebhookResponse = {
  received: true;
  matched: boolean;
  status: "ignored" | "duplicate" | "succeeded" | "needs_review" | "failed";
};

export type PaymentReconcileResult = {
  claimed: number;
  succeeded: number;
  needs_review: number;
  still_pending: number;
};

export type PaymentServiceOptions = {
  now?: () => Date;
  createId?: () => string;
  providerFactory: () => PaymentProviderClient;
  returnUrl: () => string;
  cancelUrl: () => string;
};

export class PaymentService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: PaymentServiceOptions
  ) {}

  async createPaymentOrder(
    identity: VerifiedSupabaseIdentity,
    input: unknown,
    idempotencyKey: string
  ): Promise<PaymentOrderResponse> {
    const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
    const parsed = createPaymentOrderInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new PaymentError("INVALID_INPUT", "Payment order input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }

    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      if (!actor.roles.includes("rider")) {
        throw new PaymentError("FORBIDDEN", "Only the owning rider may create payment orders.", 403);
      }
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const scope = "POST /api/v1/payments/orders";
      const decision = await prepareIdempotency(repositories.idempotency, {
        actorId: actor.id,
        scope,
        idempotencyKey: normalizedIdempotencyKey,
        request: parsed.data,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        id: createId()
      });
      if (decision.action === "conflict") {
        throw new PaymentError("CONFLICT", "Idempotency key payload mismatch.", 409);
      }
      if (decision.action === "in_progress") {
        throw new PaymentError("CONFLICT", "Idempotency key is already in progress.", 409);
      }
      if (decision.action === "replay") {
        return decision.responseBody as PaymentOrderResponse;
      }

      const quote = await repositories.quotes.findByIdForUpdate(parsed.data.quote_id);
      if (!quote) {
        throw new PaymentError("NOT_FOUND", "Quote not found.", 404);
      }
      const latest = await repositories.quotes.findLatestByRequestForUpdate(quote.requestId);
      const request = await repositories.serviceRequests.findByIdForUpdate(quote.requestId);
      const assignment = await repositories.assignments.findByIdForUpdate(quote.assignmentId);
      if (!latest || !request || !assignment) {
        throw new PaymentError("NOT_FOUND", "Payment workflow not found.", 404);
      }
      if (request.riderId !== actor.id) {
        throw new PaymentError("FORBIDDEN", "Only the owning rider may pay this quote.", 403);
      }
      if (
        latest.id !== quote.id ||
        quote.status !== "approved" ||
        request.status !== "awaiting_payment" ||
        assignment.status !== "awaiting_payment" ||
        quote.currency !== "VND"
      ) {
        throw new PaymentError("CONFLICT", "Quote is not payable.", 409);
      }
      const active = await repositories.payments.findActiveByQuoteForUpdate(quote.id);
      if (active) {
        const response = toPaymentOrderResponse(active);
        await repositories.idempotency.complete({
          actorId: actor.id,
          scope,
          idempotencyKey: normalizedIdempotencyKey,
          responseStatus: 200,
          responseBody: response as unknown as Record<string, unknown>,
          resourceType: "payment_order",
          resourceId: active.id,
          completedAt: now
        });
        return response;
      }

      const providerOrderCode = await repositories.payments.allocateProviderOrderCode();
      const expiresAt = new Date(now.getTime() + DEFAULT_PAYMENT_EXPIRY_MS);
      const order = await repositories.payments.create({
        id: createId(),
        quoteId: quote.id,
        requestId: quote.requestId,
        assignmentId: quote.assignmentId,
        riderId: actor.id,
        providerOrderCode,
        amount: quote.totalAmount,
        description: createPaymentDescription(providerOrderCode),
        createdAt: now,
        updatedAt: now,
        expiresAt
      });

      const provider = this.options.providerFactory();
      const providerLink = await provider.createPaymentLink({
        orderCode: providerOrderCode,
        amount: order.amount,
        description: order.description,
        returnUrl: this.options.returnUrl(),
        cancelUrl: this.options.cancelUrl(),
        expiredAt: Math.floor(expiresAt.getTime() / 1000)
      });
      const updated = await repositories.payments.updateProviderFields({
        id: order.id,
        status: "pending",
        providerPaymentLinkId: providerLink.paymentLinkId,
        checkoutUrl: providerLink.checkoutUrl,
        qrCode: providerLink.qrCode,
        updatedAt: now,
        expiresAt
      });
      if (!updated) {
        throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
      }
      await appendPaymentAuditOutbox(repositories, {
        action: "payment.pending",
        order: updated,
        actorId: actor.id,
        actorRole: "rider",
        now,
        createId
      });
      const response = toPaymentOrderResponse(updated);
      await repositories.idempotency.complete({
        actorId: actor.id,
        scope,
        idempotencyKey: normalizedIdempotencyKey,
        responseStatus: 201,
        responseBody: response as unknown as Record<string, unknown>,
        resourceType: "payment_order",
        resourceId: updated.id,
        completedAt: now
      });
      return response;
    });
  }

  async getPaymentOrder(
    identity: VerifiedSupabaseIdentity,
    paymentOrderId: string
  ): Promise<PaymentOrderResponse> {
    const parsedId = paymentOrderIdParamSchema.safeParse(paymentOrderId);
    if (!parsedId.success) {
      throw new PaymentError("INVALID_INPUT", "Payment order id must be a valid UUID.", 400);
    }
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const order = await repositories.payments.findById(parsedId.data);
      if (!order) {
        throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
      }
      if (
        !actor.roles.includes("admin") &&
        order.riderId !== actor.id &&
        !(actor.roles.includes("mechanic") && order.assignmentId)
      ) {
        throw new PaymentError("FORBIDDEN", "Payment order access is not allowed.", 403);
      }
      if (actor.roles.includes("mechanic")) {
        const assignment = await repositories.assignments.findById(order.assignmentId);
        if (!assignment || assignment.mechanicId !== actor.id) {
          throw new PaymentError("FORBIDDEN", "Payment order access is not allowed.", 403);
        }
      }
      return toPaymentOrderResponse(order);
    });
  }

  async cancelPaymentOrder(
    identity: VerifiedSupabaseIdentity,
    paymentOrderId: string
  ): Promise<PaymentOrderResponse> {
    const parsedId = paymentOrderIdParamSchema.safeParse(paymentOrderId);
    if (!parsedId.success) {
      throw new PaymentError("INVALID_INPUT", "Payment order id must be a valid UUID.", 400);
    }
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const order = await repositories.payments.findByIdForUpdate(parsedId.data);
      if (!order) {
        throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
      }
      if (!actor.roles.includes("rider") || order.riderId !== actor.id) {
        throw new PaymentError("FORBIDDEN", "Only the owning rider may cancel this payment order.", 403);
      }
      if (order.status !== "created" && order.status !== "pending" && order.status !== "failed") {
        throw new PaymentError("CONFLICT", "Payment order cannot be canceled.", 409);
      }
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      if (order.status === "pending") {
        await this.options.providerFactory().cancelPaymentLink({
          orderCode: order.providerOrderCode,
          cancellationReason: "rider_cancel"
        });
      }
      const updated = await repositories.payments.updateStatus({
        id: order.id,
        status: "canceled",
        updatedAt: now,
        canceledAt: now
      });
      if (!updated) {
        throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
      }
      await appendPaymentAuditOutbox(repositories, {
        action: "payment.canceled",
        order: updated,
        actorId: actor.id,
        actorRole: "rider",
        now,
        createId
      });
      return toPaymentOrderResponse(updated);
    });
  }

  async handlePayosWebhook(payload: unknown): Promise<PaymentWebhookResponse> {
    const provider = this.options.providerFactory();
    const verified = provider.verifyWebhookPayload(payload);
    if (verified.kind === "invalid") {
      throw new PaymentError("UNAUTHORIZED", "Payment webhook signature is invalid.", 401, {
        reason: verified.reason
      });
    }
    return this.applyVerifiedProviderEvent(verified);
  }

  async reconcilePendingPayments(limit = 20): Promise<PaymentReconcileResult> {
    const now = this.options.now?.() ?? new Date();
    const staleBefore = new Date(now.getTime() - 2 * 60 * 1000);
    const provider = this.options.providerFactory();
    const pending = await this.unitOfWork.execute((repositories) =>
      repositories.payments.listPendingBefore({
        provider: "payos",
        before: staleBefore,
        limit: Math.max(1, Math.min(limit, 50))
      })
    );
    const result: PaymentReconcileResult = {
      claimed: pending.length,
      succeeded: 0,
      needs_review: 0,
      still_pending: 0
    };
    for (const order of pending) {
      const status = await provider.getPaymentStatus(order.providerOrderCode);
      const event = providerStatusToEvent(status, order);
      const applied = await this.applyVerifiedProviderEvent(event);
      if (applied.status === "succeeded") {
        result.succeeded += 1;
      } else if (applied.status === "needs_review") {
        result.needs_review += 1;
      } else {
        result.still_pending += 1;
      }
    }
    return result;
  }

  private async applyVerifiedProviderEvent(
    event: Extract<VerifiedPaymentEvent, { kind: "valid" }>
  ): Promise<PaymentWebhookResponse> {
    return this.unitOfWork.execute(async (repositories) => {
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const existingEvent = await repositories.payments.findEventByDedupeKey(
        "payos",
        event.eventDedupeKey
      );
      if (existingEvent) {
        return { received: true, matched: Boolean(existingEvent.paymentOrderId), status: "duplicate" };
      }
      const order = await repositories.payments.findByProviderOrderCodeForUpdate(
        "payos",
        event.orderCode
      );
      if (!order) {
        await repositories.payments.createEvent(toPaymentEvent({ event, now, createId }));
        return { received: true, matched: false, status: "ignored" };
      }
      await repositories.payments.createEvent(
        toPaymentEvent({ event, order, now, createId })
      );
      if (order.status === "succeeded") {
        return { received: true, matched: true, status: "duplicate" };
      }
      if (!event.success) {
        const failed = await repositories.payments.updateStatus({
          id: order.id,
          status: "failed",
          updatedAt: now,
          failureCode: event.status
        });
        if (failed) {
          await appendPaymentAuditOutbox(repositories, {
            action: "payment.failed",
            order: failed,
            now,
            createId
          });
        }
        return { received: true, matched: true, status: "failed" };
      }
      if (
        event.amount !== order.amount ||
        event.currency !== order.currency ||
        (event.paymentLinkId &&
          order.providerPaymentLinkId &&
          event.paymentLinkId !== order.providerPaymentLinkId)
      ) {
        const review = await repositories.payments.updateStatus({
          id: order.id,
          status: "needs_review",
          updatedAt: now,
          reviewReason: "provider_payment_mismatch"
        });
        if (review) {
          await appendPaymentAuditOutbox(repositories, {
            action: "payment.needs_review",
            order: review,
            now,
            createId
          });
        }
        return { received: true, matched: true, status: "needs_review" };
      }
      const succeeded = await repositories.payments.updateStatus({
        id: order.id,
        status: "succeeded",
        updatedAt: now,
        succeededAt: now
      });
      if (!succeeded) {
        throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
      }
      await appendPaymentAuditOutbox(repositories, {
        action: "payment.succeeded",
        order: succeeded,
        now,
        createId
      });
      return { received: true, matched: true, status: "succeeded" };
    });
  }
}

export class PaymentError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "UNAUTHORIZED"
    >,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export function toPaymentOrderResponse(order: PaymentOrder): PaymentOrderResponse {
  return {
    id: order.id,
    quote_id: order.quoteId,
    request_id: order.requestId,
    assignment_id: order.assignmentId,
    rider_id: order.riderId,
    provider: order.provider,
    provider_order_code: order.providerOrderCode,
    provider_payment_link_id: order.providerPaymentLinkId,
    status: order.status,
    currency: order.currency,
    amount: order.amount,
    checkout_url: order.checkoutUrl,
    qr_code: order.qrCode,
    description: order.description,
    failure_code: order.failureCode,
    review_reason: order.reviewReason,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
    expires_at: order.expiresAt?.toISOString(),
    succeeded_at: order.succeededAt?.toISOString(),
    canceled_at: order.canceledAt?.toISOString()
  };
}

async function appendPaymentAuditOutbox(
  repositories: FoundationRepositories,
  input: {
    action: string;
    order: PaymentOrder;
    actorId?: string;
    actorRole?: "rider" | "mechanic" | "admin";
    now: Date;
    createId: () => string;
  }
): Promise<void> {
  const payload = {
    payment_order_id: input.order.id,
    quote_id: input.order.quoteId,
    assignment_id: input.order.assignmentId,
    request_id: input.order.requestId,
    provider: input.order.provider,
    provider_order_code: input.order.providerOrderCode,
    status: input.order.status,
    currency: input.order.currency,
    amount: input.order.amount,
    ...(input.order.failureCode ? { failure_code: input.order.failureCode } : {}),
    ...(input.order.reviewReason ? { review_reason: input.order.reviewReason } : {})
  };
  const occurrenceId = input.createId();
  await repositories.outbox.append({
    id: occurrenceId,
    topic: input.action,
    aggregateType: "payment_order",
    aggregateId: input.order.id,
    dedupeKey: `${input.action}:${input.order.id}:${occurrenceId}`,
    payload,
    createdAt: input.now,
    nextAttemptAt: input.now
  });
  await repositories.audit.append({
    id: input.createId(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: "payment_order",
    entityId: input.order.id,
    requestId: input.order.requestId,
    metadata: payload,
    createdAt: input.now
  });
}

function normalizeIdempotencyKey(idempotencyKey: string): string {
  const normalized = idempotencyKey.trim();
  if (normalized.length < 8 || normalized.length > 200) {
    throw new PaymentError(
      "INVALID_INPUT",
      "X-Idempotency-Key is required for payment order creation.",
      400
    );
  }
  return normalized;
}

function createPaymentDescription(orderCode: number): string {
  return `COR${String(orderCode).slice(-6)}`;
}

function providerStatusToEvent(
  status: ProviderPaymentStatus,
  order: PaymentOrder
): Extract<VerifiedPaymentEvent, { kind: "valid" }> {
  return {
    kind: "valid",
    eventDedupeKey: `reconcile:${status.orderCode}:${status.status}:${status.amountPaid ?? 0}`,
    success: status.status === "PAID" || status.amountPaid === order.amount,
    orderCode: status.orderCode,
    amount: status.amount,
    currency: status.currency,
    paymentLinkId: status.paymentLinkId,
    status: status.status
  };
}

function toPaymentEvent(input: {
  event: Extract<VerifiedPaymentEvent, { kind: "valid" }>;
  order?: PaymentOrder;
  now: Date;
  createId: () => string;
}): PaymentEvent {
  return {
    id: input.createId(),
    provider: "payos",
    eventDedupeKey: input.event.eventDedupeKey,
    paymentOrderId: input.order?.id,
    providerOrderCode: input.event.orderCode,
    providerPaymentLinkId: input.event.paymentLinkId,
    providerReference: input.event.providerReference,
    eventType: input.event.success ? "payment_success" : "payment_failed",
    amount: input.event.amount,
    currency: input.event.currency,
    status: input.event.status,
    signatureValid: true,
    receivedAt: input.now
  };
}
