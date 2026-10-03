import { randomUUID } from "node:crypto";
import { MAX_PAYMENT_AMOUNT } from "./payment-amount";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { loadActiveActor } from "@/features/assignments/assignment.service";
import { loadActiveAdminActor } from "@/features/admin/admin.authorization";
import { persistNotification } from "@/features/notifications/notification.service";
import { hashIdempotencyRequest, prepareIdempotency } from "@/lib/idempotency";
import type {
  PaymentEvent,
  PaymentOrder,
  PaymentOrderStatus
} from "@/server/repositories/contracts/payment.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import type { Assignment } from "@/server/repositories/contracts/assignment.repository";
import type { Quote } from "@/server/repositories/contracts/quote.repository";
import type { ApiErrorCode } from "@/lib/api-error";

import { createPaymentOrderInputSchema, paymentOrderIdParamSchema, resolvePaymentReviewInputSchema } from "./payment.schemas";
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
  failed?: number;
};

export type PaymentSummaryResponse = {
  request_id: string;
  assignment_id: string;
  quote_id: string;
  labor_quote_id?: string;
  pending_quote_id?: string;
  payment_timing?: "labor_upfront" | "after_repair" | "after_service";
  currency: "VND";
  labor_amount: number;
  parts_amount: number;
  other_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  quote_status: string;
  assignment_status: string;
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

  async getPaymentSummary(identity: VerifiedSupabaseIdentity, requestId: string): Promise<PaymentSummaryResponse> {
    if (!paymentOrderIdParamSchema.safeParse(requestId).success) throw new PaymentError("INVALID_INPUT", "Request id must be a UUID.", 400);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const request = await repositories.serviceRequests.findByIdForUpdate(requestId);
      if (!request) throw new PaymentError("NOT_FOUND", "Service request not found.", 404);
      const latest = await repositories.quotes.findLatestByRequest(requestId);
      const assignment = latest ? await repositories.assignments.findById(latest.assignmentId) : undefined;
      if (!latest || !assignment) throw new PaymentError("NOT_FOUND", "Payment workflow not found.", 404);
      if (!actor.roles.includes("admin") && request.riderId !== actor.id && !(actor.roles.includes("mechanic") && assignment.mechanicId === actor.id)) throw new PaymentError("FORBIDDEN", "Payment summary access is not allowed.", 403);
      const laborId = assignment.maintenanceLaborQuoteId ?? assignment.rescueLaborQuoteId;
      const labor = laborId ? await repositories.quotes.findById(laborId) : undefined;
      const maintenance = Boolean(assignment.maintenanceLaborQuoteId);
      const quote = maintenance ? (await repositories.quotes.findLatestApprovedByAssignment(assignment.id, "maintenance_work")) ?? labor ?? latest : latest;
      const paid = await repositories.payments.sumSucceededForAssignment(assignment.id);
      const laborAmount = !maintenance && labor ? labor.totalAmount : quote.lines.filter((line) => line.lineType === "labor").reduce((amount, line) => amount + line.lineTotalAmount, 0);
      return { request_id: requestId, assignment_id: assignment.id, quote_id: quote.id, labor_quote_id: labor?.id,
        pending_quote_id: maintenance && latest.status === "pending" ? latest.id : undefined,
        payment_timing: maintenance ? "after_service" : assignment.rescuePaymentTiming, currency: "VND", labor_amount: laborAmount,
        parts_amount: quote.purpose === "rescue_final" ? quote.totalAmount - laborAmount : quote.lines.filter((line) => line.lineType === "part").reduce((amount, line) => amount + line.lineTotalAmount, 0),
        other_amount: quote.lines.filter((line) => line.lineType === "other").reduce((amount, line) => amount + line.lineTotalAmount, 0),
        total_amount: quote.totalAmount, paid_amount: paid, remaining_amount: Math.max(0, quote.totalAmount - paid),
        quote_status: quote.status, assignment_status: assignment.status };
    });
  }

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

    const provider = this.options.providerFactory();
    const returnUrl = this.options.returnUrl();
    const cancelUrl = this.options.cancelUrl();
    const reserved = await this.unitOfWork.execute(async (repositories) => {
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
        const order = await repositories.payments.findById(decision.resourceId ?? String(decision.responseBody.id));
        if (!order || order.riderId !== actor.id) throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
        return order;
      }

      const snapshot = await repositories.quotes.findById(parsed.data.quote_id);
      if (!snapshot) {
        throw new PaymentError("NOT_FOUND", "Quote not found.", 404);
      }
      const request = await repositories.serviceRequests.findByIdForUpdate(snapshot.requestId);
      const assignment = await repositories.assignments.findByIdForUpdate(snapshot.assignmentId);
      const quote = await repositories.quotes.findByIdForUpdate(snapshot.id);
      const latest = await repositories.quotes.findLatestByRequestForUpdate(snapshot.requestId);
      if (!quote || !latest || !request || !assignment) {
        throw new PaymentError("NOT_FOUND", "Payment workflow not found.", 404);
      }
      if (request.riderId !== actor.id) {
        throw new PaymentError("FORBIDDEN", "Only the owning rider may pay this quote.", 403);
      }
      const upfrontLabor = quote.purpose === "rescue_labor" && assignment.rescueLaborQuoteId === quote.id && assignment.rescuePaymentTiming === "labor_upfront";
      const payable = await latestPayableQuote(repositories, assignment, latest);
      if (
        payable?.id !== quote.id ||
        quote.status !== "approved" ||
        request.status !== (upfrontLabor ? "assigned" : "awaiting_payment") ||
        assignment.status !== (upfrontLabor ? "accepted" : "awaiting_payment") ||
        (quote.purpose === "rescue_labor" && !upfrontLabor) ||
        quote.purpose === "maintenance_labor" ||
        (assignment.maintenanceLaborQuoteId && quote.purpose !== "maintenance_work") ||
        quote.currency !== "VND"
      ) {
        throw new PaymentError("CONFLICT", "Quote is not payable.", 409);
      }
      if (await repositories.payments.hasSucceededForAssignment({ assignmentId: assignment.id, requestId: request.id, quoteId: quote.id })) {
        throw new PaymentError("CONFLICT", "This quote has already been paid.", 409);
      }
      const alreadyPaid = quote.purpose === "rescue_final" || quote.purpose === "maintenance_work" ? await repositories.payments.sumSucceededForAssignment(assignment.id) : 0;
      const amountDue = quote.totalAmount - alreadyPaid;
      if (amountDue <= 0 || amountDue > MAX_PAYMENT_AMOUNT) throw new PaymentError("CONFLICT", "No supported outstanding amount is payable.", 409);
      const active = await repositories.payments.findActiveByQuoteForUpdate(quote.id);
      if (active?.status === "needs_review") throw new PaymentError("CONFLICT", "Resolve the payment under review before collecting again.", 409);
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
        return active;
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
        amount: amountDue,
        description: createPaymentDescription(providerOrderCode),
        createdAt: now,
        updatedAt: now,
        expiresAt
      });

      await appendPaymentAuditOutbox(repositories, {
        action: "payment.created",
        order,
        actorId: actor.id,
        actorRole: "rider",
        now,
        createId
      });
      const response = toPaymentOrderResponse(order);
      await repositories.idempotency.complete({
        actorId: actor.id,
        scope,
        idempotencyKey: normalizedIdempotencyKey,
        responseStatus: 201,
        responseBody: response as unknown as Record<string, unknown>,
        resourceType: "payment_order",
        resourceId: order.id,
        completedAt: now
      });
      return order;
    });
    return toPaymentOrderResponse(await this.initializePaymentLink(reserved, provider, returnUrl, cancelUrl));
  }

  private async initializePaymentLink(order: PaymentOrder, provider: PaymentProviderClient,
    returnUrl: string, cancelUrl: string): Promise<PaymentOrder> {
    if (order.status !== "created") return order;
    const now = this.options.now?.() ?? new Date();
    const expiresAt = order.expiresAt && order.expiresAt > now ? order.expiresAt : new Date(now.getTime() + DEFAULT_PAYMENT_EXPIRY_MS);
    const link = await provider.createPaymentLink({ orderCode: order.providerOrderCode, amount: order.amount,
      description: order.description, returnUrl, cancelUrl, expiredAt: Math.floor(expiresAt.getTime() / 1000) });
    const updated = await this.unitOfWork.execute(async (repositories) => {
      const current = await repositories.payments.findByIdForUpdate(order.id);
      if (!current) throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
      // A webhook may have settled the durable order while link creation was in flight.
      const now = this.options.now?.() ?? new Date();
      const changed = await repositories.payments.updateProviderFields({ id: order.id,
        status: current.status === "created" ? "pending" : current.status,
        providerPaymentLinkId: link.paymentLinkId, checkoutUrl: link.checkoutUrl, qrCode: link.qrCode, updatedAt: now, expiresAt });
      if (!changed) throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
      if (current.status === "created") await appendPaymentAuditOutbox(repositories, {
        action: "payment.pending", order: changed, actorId: order.riderId, actorRole: "rider", now, createId: this.options.createId ?? randomUUID });
      return changed;
    });
    if (link.status !== "PENDING") {
      const status = await provider.getPaymentStatus(order.providerOrderCode);
      await this.applyVerifiedProviderEvent(providerStatusToEvent(status));
      return this.unitOfWork.execute(async (repositories) => (await repositories.payments.findById(order.id))!);
    }
    return updated;
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
      if (!actor.roles.includes("admin") && order.riderId !== actor.id && actor.roles.includes("mechanic")) {
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
      if (order.status === "created") throw new PaymentError("CONFLICT", "Payment link creation is being recovered; retry after reconciliation.", 409);
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      if (order.status === "pending" || order.status === "failed") {
        const cancellation = await this.options.providerFactory().cancelPaymentLink({
          orderCode: order.providerOrderCode,
          cancellationReason: "rider_cancel"
        });
        if (cancellation.orderCode !== order.providerOrderCode || cancellation.status !== "CANCELLED" || (cancellation.amountPaid ?? 0) > 0) throw new PaymentError("CONFLICT", "Payment cancellation was not confirmed; await reconciliation.", 409);
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

  async resolvePaymentReview(identity: VerifiedSupabaseIdentity, paymentOrderId: string,
    input: unknown, idempotencyKey: string): Promise<Record<string, unknown>> {
    const parsed = resolvePaymentReviewInputSchema.safeParse(input);
    if (!parsed.success || !paymentOrderIdParamSchema.safeParse(paymentOrderId).success) {
      throw new PaymentError("INVALID_INPUT", "Payment review input is invalid.", 400);
    }
    const key = normalizeIdempotencyKey(idempotencyKey);
    const scope = `POST /api/v1/admin/payments/orders/${paymentOrderId}/resolve`;
    const snapshot = await this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const replay = await repositories.idempotency.find(actor.id, scope, key);
      if (replay && replay.requestHash !== hashIdempotencyRequest(parsed.data)) throw new PaymentError("CONFLICT", "Idempotency key payload mismatch.", 409);
      if (replay?.completedAt && replay.responseBody) return { response: replay.responseBody };
      const order = await repositories.payments.findById(paymentOrderId);
      if (!order) throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
      if (order.status !== "needs_review") throw new PaymentError("CONFLICT", "Payment is not under review.", 409);
      return { order };
    });
    if (snapshot.response) return snapshot.response;
    const verified = await this.options.providerFactory().getPaymentStatus(snapshot.order!.providerOrderCode);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const decision = await prepareIdempotency(repositories.idempotency, { actorId: actor.id, scope,
        idempotencyKey: key, request: parsed.data, expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS), id: createId() });
      if (decision.action === "replay") return decision.responseBody;
      if (decision.action !== "execute") throw new PaymentError("CONFLICT", "Payment resolution is already in progress or conflicts.", 409);
      const request = await repositories.serviceRequests.findByIdForUpdate(snapshot.order!.requestId);
      const assignment = await repositories.assignments.findByIdForUpdate(snapshot.order!.assignmentId);
      const quote = await repositories.quotes.findByIdForUpdate(snapshot.order!.quoteId);
      const latest = await repositories.quotes.findLatestByRequestForUpdate(snapshot.order!.requestId);
      const order = await repositories.payments.findByIdForUpdate(paymentOrderId);
      if (!order || order.status !== "needs_review") throw new PaymentError("CONFLICT", "Payment is no longer under review.", 409);
      if (verified.orderCode !== order.providerOrderCode || verified.amount !== order.amount || verified.currency !== order.currency ||
        !verified.paymentLinkId || (order.providerPaymentLinkId && verified.paymentLinkId !== order.providerPaymentLinkId)) {
        throw new PaymentError("CONFLICT", "Provider payment identity does not match; manual bank investigation is required.", 409);
      }
      const paid = verified.amountPaid;
      const confirming = parsed.data.action === "confirm_received";
      if (confirming) {
        const upfrontLabor = quote?.purpose === "rescue_labor" && assignment?.rescueLaborQuoteId === quote.id && assignment.rescuePaymentTiming === "labor_upfront";
        const active = await repositories.payments.findActiveByQuoteForUpdate(order.quoteId, order.id);
        const alreadyPaid = await repositories.payments.sumSucceededForAssignment(order.assignmentId);
        const payable = assignment ? await latestPayableQuote(repositories, assignment, latest) : undefined;
        if (verified.status !== "PAID" || paid !== order.amount || !request || !assignment || !quote || payable?.id !== quote.id || quote.status !== "approved" ||
          assignment.status !== (upfrontLabor ? "accepted" : "awaiting_payment") || request.status !== (upfrontLabor ? "assigned" : "awaiting_payment") ||
          (quote.purpose === "rescue_labor" && !upfrontLabor) ||
          quote.purpose === "maintenance_labor" ||
          (assignment.maintenanceLaborQuoteId && quote.purpose !== "maintenance_work") ||
          active ||
          await repositories.payments.hasSucceededForAssignment({ assignmentId: order.assignmentId, requestId: order.requestId, quoteId: order.quoteId }) ||
          (quote.purpose === "rescue_final" || quote.purpose === "maintenance_work" ? quote.totalAmount - alreadyPaid : quote.totalAmount) !== order.amount) {
          throw new PaymentError("CONFLICT", "Payment cannot be credited to this job; investigate duplicate, partial or excess funds manually.", 409);
        }
      } else if (paid !== 0 || !["CANCELLED", "EXPIRED", "FAILED"].includes(verified.status)) {
        throw new PaymentError("CONFLICT", "Only a verified terminal unpaid payment may be closed.", 409);
      }
      const updated = await repositories.payments.updateStatus({ id: order.id, status: confirming ? "succeeded" : "canceled",
        reviewReason: confirming ? "admin_verified_received" : "admin_verified_unpaid", updatedAt: now,
        ...(confirming ? { succeededAt: now } : { canceledAt: now }) });
      if (!updated) throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
      await appendPaymentAuditOutbox(repositories, { action: confirming ? "payment.succeeded" : "payment.canceled", order: updated, actorId: actor.id, actorRole: "admin", now, createId });
      await repositories.audit.append({ id: createId(), actorId: actor.id, actorRole: "admin", action: "payment.review.resolved",
        entityType: "payment_order", entityId: order.id, requestId: order.requestId,
        metadata: { action: parsed.data.action, reason_hash: hashIdempotencyRequest(parsed.data.reason), previous_status: order.status, status: updated.status }, createdAt: now });
      const response = { id: updated.id, request_id: updated.requestId, quote_id: updated.quoteId,
        status: updated.status, amount: updated.amount, currency: updated.currency, review_reason: updated.reviewReason, resolved_at: now.toISOString() };
      await repositories.idempotency.complete({ actorId: actor.id, scope, idempotencyKey: key, responseStatus: 200,
        responseBody: response, resourceType: "payment_order", resourceId: order.id, completedAt: now });
      return response;
    });
  }

  async reconcilePendingPayments(limit = 20): Promise<PaymentReconcileResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new PaymentError("INVALID_INPUT", "Reconciliation limit must be between 1 and 50.", 400);
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
      still_pending: 0,
      failed: 0
    };
    for (const order of pending) {
      try {
      if (order.status === "created") {
        const restored = await this.initializePaymentLink(order, provider, this.options.returnUrl(), this.options.cancelUrl());
        if (restored.status === "succeeded") { result.succeeded += 1; continue; }
        if (restored.status === "needs_review") { result.needs_review += 1; continue; }
      }
      const status = await provider.getPaymentStatus(order.providerOrderCode);
      if (status.orderCode !== order.providerOrderCode) throw new PaymentError("CONFLICT", "Provider order code mismatch.", 409);
      if (status.status === "PENDING" && (status.amountPaid ?? 0) === 0) {
        result.still_pending += 1;
        continue;
      }
      const event = providerStatusToEvent(status);
      const applied = await this.applyVerifiedProviderEvent(event);
      if (applied.status === "succeeded") {
        result.succeeded += 1;
      } else if (applied.status === "needs_review") {
        result.needs_review += 1;
      } else {
        result.still_pending += 1;
      }
      } catch {
        result.failed = (result.failed ?? 0) + 1;
        await this.unitOfWork.execute(async (repositories) => {
          const current = await repositories.payments.findByIdForUpdate(order.id);
          if (current && ["created", "pending"].includes(current.status)) await repositories.payments.updateProviderFields({
            id: current.id, status: current.status, updatedAt: now });
        });
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
      const snapshot = await repositories.payments.findByProviderOrderCode(
        "payos",
        event.orderCode
      );
      if (!snapshot) {
        await repositories.payments.createEvent(toPaymentEvent({ event, now, createId }));
        return { received: true, matched: false, status: "ignored" };
      }
      const request = await repositories.serviceRequests.findByIdForUpdate(snapshot.requestId);
      const assignment = await repositories.assignments.findByIdForUpdate(snapshot.assignmentId);
      const quote = await repositories.quotes.findByIdForUpdate(snapshot.quoteId);
      const order = await repositories.payments.findByIdForUpdate(snapshot.id);
      if (!order) throw new PaymentError("NOT_FOUND", "Payment order not found.", 404);
      // Another delivery may have committed while this transaction waited for the order lock.
      if (await repositories.payments.findEventByDedupeKey("payos", event.eventDedupeKey)) {
        return { received: true, matched: true, status: "duplicate" };
      }
      await repositories.payments.createEvent(
        toPaymentEvent({ event, order, now, createId })
      );
      if (order.status === "succeeded") {
        return { received: true, matched: true, status: "duplicate" };
      }
      if (order.status === "needs_review") return { received: true, matched: true, status: "needs_review" };
      if (order.status === "canceled" && !event.success) return { received: true, matched: true, status: "ignored" };
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
      const inactiveWorkflow = !request || !assignment || !quote || quote.status !== "approved" || quote.assignmentId !== assignment.id ||
        ["canceled", "completed"].includes(request.status) ||
        ["canceled", "completed", "recovery_canceled"].includes(assignment.status);
      if (
        inactiveWorkflow ||
        order.status === "canceled" ||
        await repositories.payments.hasSucceededForAssignment({ assignmentId: order.assignmentId, requestId: order.requestId, quoteId: order.quoteId }) ||
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
          reviewReason: inactiveWorkflow ? "paid_for_inactive_workflow" : order.status === "canceled" ? "paid_after_cancellation" : "provider_payment_mismatch"
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
  if (input.action === "payment.succeeded") {
    const request = await repositories.serviceRequests.findById(input.order.requestId);
    const assignment = await repositories.assignments.findById(input.order.assignmentId);
    if (request && assignment) {
      for (const userId of [request.riderId, assignment.mechanicId]) await persistNotification(repositories, {
        userId, type: "payment.succeeded", title: request.serviceType === "periodic_maintenance" ? "Thanh toán bảo dưỡng đã được xác nhận" : "Thanh toán đã được xác nhận",
        body: "Mở yêu cầu để xem số tiền còn lại và bước tiếp theo.",
        data: { request_id: request.id, assignment_id: assignment.id, payment_order_id: input.order.id },
        dedupeKey: `payment.succeeded:${input.order.id}:${userId}`, requestId: request.id
      }, input.now, input.createId);
    }
  }
}

async function latestPayableQuote(repositories: FoundationRepositories, assignment: Assignment, latest?: Quote): Promise<Quote | undefined> {
  if (!assignment.maintenanceLaborQuoteId) return latest;
  if (!latest || latest.assignmentId !== assignment.id || latest.status === "pending") return undefined;
  return repositories.quotes.findLatestApprovedByAssignment(assignment.id, "maintenance_work");
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

function providerStatusToEvent(status: ProviderPaymentStatus): Extract<VerifiedPaymentEvent, { kind: "valid" }> {
  return {
    kind: "valid",
    eventDedupeKey: `reconcile:${status.orderCode}:${status.status}:${status.amountPaid ?? 0}`,
    success: status.status === "PAID" || (status.amountPaid ?? 0) > 0,
    orderCode: status.orderCode,
    amount: status.amountPaid ?? status.amount,
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
    eventType: input.event.currency !== "VND" ? "payment_currency_mismatch" : input.event.success ? "payment_success" : "payment_failed",
    amount: input.event.amount,
    // The ledger supports VND only; retain a mismatched signed receipt as an
    // explicit mismatch event without falsely denominating its amount in VND.
    currency: input.event.currency === "VND" ? "VND" : undefined,
    status: input.event.status,
    signatureValid: true,
    receivedAt: input.now
  };
}
