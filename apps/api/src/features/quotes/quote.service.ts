import { randomUUID } from "node:crypto";
import { MAX_PAYMENT_AMOUNT } from "@/features/payments/payment-amount";

import type { ApiErrorCode } from "@/lib/api-error";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { persistNotification } from "@/features/notifications/notification.service";
import {
  appendAssignmentAuditOutbox,
  loadActiveActor,
  primaryAuditRole
} from "@/features/assignments/assignment.service";
import { assertAssignmentStatusTransition } from "@/features/assignments/assignment-state";
import { assertRequestStatusTransition } from "@/features/service-requests/service-request-state";
import type { Quote, QuoteStatus, QuotePurpose, RescueLaborPricing } from "@/server/repositories/contracts/quote.repository";
import type { AssignmentStatus } from "@/server/repositories/contracts/assignment.repository";
import type { RequestStatus } from "@/server/repositories/contracts/service-request.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import {
  calculateQuote,
  MAX_QUOTE_AMOUNT,
  QuoteCalculationError
} from "./quote-calculator";
import { approveQuoteInputSchema, quoteInputSchema } from "./quote.schemas";

export { MAX_QUOTE_AMOUNT };

export type QuoteLineResponse = {
  id: string;
  line_type: "labor" | "part" | "other";
  description: string;
  quantity: number;
  unit_amount: number;
  line_total_amount: number;
  sort_order: number;
};

export type QuoteResponse = {
  id: string;
  request_id: string;
  assignment_id: string;
  purpose?: QuotePurpose;
  labor_pricing?: RescueLaborPricing;
  diagnosis_id?: string;
  version: number;
  status: QuoteStatus;
  currency: "VND";
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  expires_at?: string;
  created_by: string;
  created_at: string;
  responded_at?: string;
  lines: QuoteLineResponse[];
};

export type QuoteServiceOptions = {
  now?: () => Date;
  createId?: () => string;
};

export class QuoteService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: QuoteServiceOptions = {}
  ) {}

  async createQuote(
    identity: VerifiedSupabaseIdentity,
    requestId: string,
    input: unknown
  ): Promise<QuoteResponse> {
    const parsed = quoteInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new QuoteError("INVALID_INPUT", "Quote input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }

    let calculated: ReturnType<typeof calculateQuote>;
    try {
      calculated = calculateQuote(parsed.data.lines, parsed.data.discount_amount);
    } catch (error) {
      if (error instanceof QuoteCalculationError) {
        throw new QuoteError("INVALID_INPUT", error.message, 400);
      }
      throw error;
    }

    if (parsed.data.purpose === "standard" && (calculated.total_amount <= 0 || calculated.total_amount > MAX_PAYMENT_AMOUNT)) {
      throw new QuoteError("INVALID_INPUT", "Standard quote total must be positive and within the supported payment amount.", 400);
    }

    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const request = await repositories.serviceRequests.findByIdForUpdate(requestId);
      if (!request) throw new QuoteError("NOT_FOUND", "Service request not found.", 404);
      const assignment = await repositories.assignments.findByIdForUpdate(
        parsed.data.assignment_id
      );
      if (!assignment) {
        throw new QuoteError("NOT_FOUND", "Assignment not found.", 404);
      }
      if (assignment.requestId !== requestId) {
        throw new QuoteError("FORBIDDEN", "Assignment does not belong to the request.", 403);
      }
      if (
        !actor.roles.includes("admin") &&
        (!actor.roles.includes("mechanic") || assignment.mechanicId !== actor.id)
      ) {
        throw new QuoteError(
          "FORBIDDEN",
          "Assigned mechanic or admin access is required.",
          403
        );
      }

      const latest = await repositories.quotes.findLatestByRequestForUpdate(requestId);
      const firstVersion = !latest || latest.assignmentId !== assignment.id || (latest.purpose ?? "standard") !== parsed.data.purpose ||
        (["voided", "expired"].includes(latest.status) && assignment.status !== "quoted");
      const rescue = request.serviceType === "emergency_rescue";
      const maintenance = request.serviceType === "periodic_maintenance";
      const maintenanceQuote = parsed.data.purpose === "maintenance_labor" || parsed.data.purpose === "maintenance_work";
      const legacyMaintenance = maintenance && !assignment.maintenanceLaborQuoteId && latest?.assignmentId === assignment.id && (latest.purpose ?? "standard") === "standard";
      if (rescue ? !["rescue_labor", "rescue_final"].includes(parsed.data.purpose)
        : maintenance ? !(maintenanceQuote || (legacyMaintenance && parsed.data.purpose === "standard")) : parsed.data.purpose !== "standard") {
        throw new QuoteError("INVALID_INPUT", "Quote purpose does not match the service workflow.", 400);
      }
      const preTravelLabor = parsed.data.purpose === "rescue_labor" || parsed.data.purpose === "maintenance_labor";
      const maintenanceAddition = maintenance && parsed.data.purpose === "maintenance_work" && assignment.status === "in_progress";
      const now = this.options.now?.() ?? new Date();
      let laborPricing: RescueLaborPricing | undefined;
      if (parsed.data.purpose === "rescue_labor") {
        if (assignment.rescueLaborQuoteId) throw new QuoteError("CONFLICT", "Rescue labor is already agreed and cannot change.", 409);
        const candidate = assignment.acceptedCandidateId ? await repositories.dispatch.findCandidateById(assignment.acceptedCandidateId) : undefined;
        const distance = assignment.dispatchDistanceMeters ?? candidate?.distanceMeters;
        if (distance === undefined) throw new QuoteError("CONFLICT", "Verified dispatch distance is required for rescue pricing.", 409);
        const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(now));
        laborPricing = {
          ...parsed.data.labor_pricing!, distance_m: distance,
          time_slot: hour >= 5 && hour < 11 ? "morning" : hour >= 11 && hour < 17 ? "midday" : hour >= 17 && hour < 22 ? "evening" : "late_night"
        };
        calculated = calculateValidatedQuote([
          { line_type: "labor", description: "Tiền công cơ bản", quantity: 1, unit_amount: laborPricing.base_amount },
          { line_type: "labor", description: `Phí khoảng cách ${laborPricing.distance_m} m`, quantity: 1, unit_amount: laborPricing.distance_amount },
          { line_type: "labor", description: `Phí thời tiết ${laborPricing.weather}`, quantity: 1, unit_amount: laborPricing.weather_amount },
          { line_type: "labor", description: `Phí thời điểm ${laborPricing.time_slot}`, quantity: 1, unit_amount: laborPricing.time_amount }
        ], 0);
      }
      if (parsed.data.purpose === "rescue_final") {
        const labor = assignment.rescueLaborQuoteId ? await repositories.quotes.findById(assignment.rescueLaborQuoteId) : undefined;
        if (!labor || labor.status !== "approved" || labor.assignmentId !== assignment.id || labor.purpose !== "rescue_labor") {
          throw new QuoteError("CONFLICT", "An approved rescue labor agreement is required.", 409);
        }
        calculated = calculateValidatedQuote([
          ...labor.lines.map((line) => ({ line_type: line.lineType, description: line.description, quantity: line.quantity, unit_amount: line.unitAmount })),
          ...parsed.data.lines
        ], 0);
      }
      if (parsed.data.purpose === "maintenance_labor") {
        if (assignment.maintenanceLaborQuoteId) throw new QuoteError("CONFLICT", "Maintenance labor is already agreed and cannot change.", 409);
        if (!calculated.lines.some((line) => line.line_type === "labor" && line.line_total_amount > 0)) throw new QuoteError("INVALID_INPUT", "Maintenance labor must have a positive total.", 400);
      }
      if (parsed.data.purpose === "maintenance_work") {
        const labor = assignment.maintenanceLaborQuoteId ? await repositories.quotes.findById(assignment.maintenanceLaborQuoteId) : undefined;
        if (!labor || labor.status !== "approved" || labor.assignmentId !== assignment.id || labor.purpose !== "maintenance_labor") {
          throw new QuoteError("CONFLICT", "An approved maintenance labor agreement is required.", 409);
        }
        let basis = labor;
        if (maintenanceAddition) {
          const approved = await repositories.quotes.findLatestApprovedByAssignment(assignment.id, "maintenance_work");
          if (!approved || parsed.data.basis_quote_id !== approved.id) throw new QuoteError("CONFLICT", "Additions must reference the latest approved maintenance work quote.", 409);
          if (!parsed.data.lines.length || calculated.total_amount <= 0) throw new QuoteError("INVALID_INPUT", "A maintenance addition must contain new payable items.", 400);
          basis = approved;
        } else if (parsed.data.basis_quote_id || parsed.data.lines.some((line) => line.line_type !== "part")) {
          throw new QuoteError("INVALID_INPUT", "Before maintenance starts, submit parts only; agreed labor is added by the server.", 400);
        }
        calculated = calculateValidatedQuote([
          ...basis.lines.map((line) => ({ line_type: line.lineType, description: line.description, quantity: line.quantity, unit_amount: line.unitAmount })),
          ...parsed.data.lines
        ], 0);
      }
      if (
        maintenanceAddition ? request.status !== "in_service" : firstVersion
          ? assignment.status !== (preTravelLabor ? "accepted" : "diagnosis") || request.status !== (preTravelLabor ? "assigned" : "in_service")
          : assignment.status !== "quoted" ||
            request.status !== "awaiting_quote_approval"
      ) {
        throw new QuoteError("CONFLICT", "Quote workflow state is not valid.", 409);
      }

      if (parsed.data.diagnosis_id) {
        const diagnosis = await repositories.diagnoses.findById(parsed.data.diagnosis_id);
        if (!diagnosis) {
          throw new QuoteError("NOT_FOUND", "Diagnosis not found.", 404);
        }
        if (
          diagnosis.assignmentId !== assignment.id ||
          diagnosis.requestId !== request.id
        ) {
          throw new QuoteError("FORBIDDEN", "Diagnosis does not belong to this workflow.", 403);
        }
      }

      const createId = this.options.createId ?? randomUUID;
      if (latest?.status === "pending") {
        await repositories.quotes.updateStatus({
          id: latest.id,
          status: "superseded"
        });
      }

      const quote = await repositories.quotes.create({
        id: createId(),
        requestId,
        assignmentId: assignment.id,
        purpose: parsed.data.purpose,
        laborPricing,
        diagnosisId: parsed.data.diagnosis_id,
        version: (latest?.version ?? 0) + 1,
        subtotalAmount: calculated.subtotal_amount,
        discountAmount: calculated.discount_amount,
        totalAmount: calculated.total_amount,
        notes: parsed.data.notes,
        expiresAt: parsed.data.expires_at
          ? new Date(parsed.data.expires_at)
          : parsed.data.purpose === "rescue_labor" ? new Date(now.getTime() + 10 * 60 * 1000) : undefined,
        createdBy: actor.id,
        createdAt: now,
        lines: calculated.lines.map((line, index) => ({
          id: createId(),
          lineType: line.line_type,
          description: line.description,
          quantity: line.quantity,
          unitAmount: line.unit_amount,
          lineTotalAmount: line.line_total_amount,
          sortOrder: index
        }))
      });

      if (firstVersion && !maintenanceAddition) {
        await transitionWorkflow(repositories, {
          assignment,
          request,
          assignmentStatus: "quoted",
          requestStatus: "awaiting_quote_approval",
          actorId: actor.id,
          actorRole: primaryAuditRole(actor.roles),
          now,
          createId,
          reason: "quote_created"
        });
      }
      await appendQuoteAuditOutbox(repositories, {
        action: "quote.created",
        quote,
        actorId: actor.id,
        actorRole: primaryAuditRole(actor.roles),
        now,
        createId
      });
      return toQuoteResponse(quote);
    });
  }

  listQuotes(
    identity: VerifiedSupabaseIdentity,
    requestId: string
  ): Promise<{ items: QuoteResponse[] }> {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const request = await repositories.serviceRequests.findById(requestId);
      if (!request) {
        throw new QuoteError("NOT_FOUND", "Service request not found.", 404);
      }
      const hasAssignment = await repositories.assignments.hasVisibleByRequest({
        id: actor.id,
        roles: actor.roles.filter(
          (role): role is "rider" | "mechanic" | "admin" =>
            role === "rider" || role === "mechanic" || role === "admin"
        )
      }, requestId);
      if (
        !actor.roles.includes("admin") &&
        request.riderId !== actor.id &&
        !hasAssignment
      ) {
        throw new QuoteError("FORBIDDEN", "Quote access is not allowed.", 403);
      }
      return {
        items: (await repositories.quotes.listByRequest(requestId)).map(toQuoteResponse)
      };
    });
  }

  approveQuote(
    identity: VerifiedSupabaseIdentity,
    quoteId: string,
    input: unknown = {}
  ): Promise<QuoteResponse> {
    return this.decideQuote(identity, quoteId, "approved", input);
  }

  rejectQuote(
    identity: VerifiedSupabaseIdentity,
    quoteId: string
  ): Promise<QuoteResponse> {
    return this.decideQuote(identity, quoteId, "rejected");
  }

  private decideQuote(
    identity: VerifiedSupabaseIdentity,
    quoteId: string,
    decision: "approved" | "rejected",
    input: unknown = {}
  ): Promise<QuoteResponse> {
    const parsed = approveQuoteInputSchema.safeParse(input);
    if (!parsed.success) throw new QuoteError("INVALID_INPUT", "Quote approval input is invalid.", 400);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const initial = await repositories.quotes.findById(quoteId);
      if (!initial) {
        throw new QuoteError("NOT_FOUND", "Quote not found.", 404);
      }
      const request = await repositories.serviceRequests.findByIdForUpdate(
        initial.requestId
      );
      const assignment = await repositories.assignments.findByIdForUpdate(initial.assignmentId);
      const quote = await repositories.quotes.findByIdForUpdate(quoteId);
      const latest = await repositories.quotes.findLatestByRequestForUpdate(
        initial.requestId
      );
      if (!assignment || !request || !quote || !latest) {
        throw new QuoteError("NOT_FOUND", "Quote workflow not found.", 404);
      }
      if (!actor.roles.includes("rider") || request.riderId !== actor.id) {
        throw new QuoteError("FORBIDDEN", "Only the owning rider may decide a quote.", 403);
      }
      if (latest.id !== quote.id || quote.status !== "pending") {
        throw new QuoteError(
          "CONFLICT",
          "Only the latest pending quote may be approved or rejected.",
          409
        );
      }
      if (decision === "approved" && (quote.purpose ?? "standard") === "standard" &&
        (quote.totalAmount <= 0 || quote.totalAmount > MAX_PAYMENT_AMOUNT)) {
        throw new QuoteError("CONFLICT", "Replace this legacy standard quote with a supported positive total before approval.", 409);
      }
      const maintenanceAddition = quote.purpose === "maintenance_work" && assignment.status === "in_progress" && request.status === "in_service";
      if (!maintenanceAddition && (assignment.status !== "quoted" || request.status !== "awaiting_quote_approval")) {
        throw new QuoteError("CONFLICT", "Quote workflow state is not valid.", 409);
      }

      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      if (decision === "approved" && quote.expiresAt && quote.expiresAt <= now) throw new QuoteError("CONFLICT", "Quote has expired.", 409);
      const rescueLabor = quote.purpose === "rescue_labor";
      if (decision === "approved" && rescueLabor && !parsed.data.payment_timing) {
        throw new QuoteError("INVALID_INPUT", "Choose labor_upfront or after_repair when approving rescue labor.", 400);
      }
      if (!rescueLabor && parsed.data.payment_timing) throw new QuoteError("INVALID_INPUT", "Payment timing applies only to rescue labor.", 400);
      const updated = await repositories.quotes.updateStatus({
        id: quote.id,
        status: decision,
        respondedAt: now
      });
      if (!updated) {
        throw new QuoteError("NOT_FOUND", "Quote not found.", 404);
      }

      if (decision === "approved") {
        if (rescueLabor) {
          const agreed = await repositories.assignments.setRescueAgreement({ id: assignment.id, laborQuoteId: quote.id, paymentTiming: parsed.data.payment_timing!, updatedAt: now });
          if (!agreed) throw new QuoteError("CONFLICT", "Rescue labor has already been agreed.", 409);
        }
        if (quote.purpose === "maintenance_labor") {
          const agreed = await repositories.assignments.setMaintenanceAgreement({ id: assignment.id, laborQuoteId: quote.id, updatedAt: now });
          if (!agreed) throw new QuoteError("CONFLICT", "Maintenance labor has already been agreed.", 409);
        }
        if (!maintenanceAddition) await transitionWorkflow(repositories, {
          assignment,
          request,
          assignmentStatus: rescueLabor || quote.purpose === "maintenance_labor" ? "accepted" : quote.purpose === "rescue_final" || quote.purpose === "maintenance_work" ? "diagnosis" : "awaiting_payment",
          requestStatus: rescueLabor || quote.purpose === "maintenance_labor" ? "assigned" : quote.purpose === "rescue_final" || quote.purpose === "maintenance_work" ? "in_service" : "awaiting_payment",
          actorId: actor.id,
          actorRole: "rider",
          now,
          createId,
          reason: "quote_approved"
        });
      }
      if (decision === "rejected" && rescueLabor) {
        await transitionWorkflow(repositories, { assignment, request, assignmentStatus: "recovery_canceled", requestStatus: "submitted", actorId: actor.id, actorRole: "rider", now, createId, reason: "rescue_labor_rejected" });
        await repositories.dispatch.cancelOpenDispatchForRequest({ requestId: request.id, now });
        const eventId = createId();
        await repositories.outbox.append({ id: eventId, topic: "assignment.recovery.requested", aggregateType: "assignment", aggregateId: assignment.id, dedupeKey: `rescue.reject:${quote.id}`, payload: { request_id: request.id, assignment_id: assignment.id, reason_code: "rescue_labor_rejected" }, createdAt: now, nextAttemptAt: now });
      }
      await appendQuoteAuditOutbox(repositories, {
        action: `quote.${decision}`,
        quote: updated,
        actorId: actor.id,
        actorRole: "rider",
        now,
        createId
      });
      return toQuoteResponse(updated);
    });
  }
}

export class QuoteError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT"
    >,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

function calculateValidatedQuote(lines: Parameters<typeof calculateQuote>[0], discount: number) {
  try { return calculateQuote(lines, discount); }
  catch (error) {
    if (error instanceof QuoteCalculationError) throw new QuoteError("INVALID_INPUT", error.message, 400);
    throw error;
  }
}

export async function transitionWorkflow(
  repositories: FoundationRepositories,
  input: {
    assignment: Awaited<ReturnType<FoundationRepositories["assignments"]["findById"]>> &
      object;
    request: Awaited<ReturnType<FoundationRepositories["serviceRequests"]["findById"]>> &
      object;
    assignmentStatus: AssignmentStatus;
    requestStatus: RequestStatus;
    actorId: string;
    actorRole: "rider" | "mechanic" | "admin";
    now: Date;
    createId: () => string;
    reason: string;
  }
): Promise<void> {
  assertAssignmentStatusTransition(input.assignment.status, input.assignmentStatus);
  assertRequestStatusTransition(input.request.status, input.requestStatus);
  const assignment = await repositories.assignments.updateStatus({
    id: input.assignment.id,
    status: input.assignmentStatus,
    updatedAt: input.now,
    ...(input.assignmentStatus === "recovery_canceled" ? { canceledAt: input.now } : {})
  });
  if (!assignment) {
    throw new QuoteError("NOT_FOUND", "Assignment not found.", 404);
  }
  await repositories.assignments.appendStatusHistory({
    id: input.createId(),
    assignmentId: input.assignment.id,
    fromStatus: input.assignment.status,
    toStatus: input.assignmentStatus,
    actorId: input.actorId,
    actorRole: input.actorRole,
    reason: input.reason,
    createdAt: input.now
  });
  await repositories.serviceRequests.updateStatus({
    id: input.request.id,
    status: input.requestStatus,
    updatedAt: input.now
  });
  await repositories.serviceRequests.appendStatusHistory({
    id: input.createId(),
    requestId: input.request.id,
    fromStatus: input.request.status,
    toStatus: input.requestStatus,
    actorId: input.actorId,
    reason: input.reason,
    createdAt: input.now
  });
  await appendAssignmentAuditOutbox({
    action: "assignment.status_changed",
    assignment,
    actorId: input.actorId,
    actorRole: input.actorRole,
    audit: repositories.audit,
    outbox: repositories.outbox,
    now: input.now,
    createId: input.createId,
    extraPayload: {
      from_status: input.assignment.status,
      to_status: input.assignmentStatus,
      reason_code: input.reason
    }
  });
}

async function appendQuoteAuditOutbox(
  repositories: FoundationRepositories,
  input: {
    action: string;
    quote: Quote;
    actorId: string;
    actorRole: "rider" | "mechanic" | "admin";
    now: Date;
    createId: () => string;
  }
): Promise<void> {
  const occurrenceId = input.createId();
  const payload = {
    quote_id: input.quote.id,
    assignment_id: input.quote.assignmentId,
    request_id: input.quote.requestId,
    version: input.quote.version,
    status: input.quote.status
  };
  await repositories.outbox.append({
    id: occurrenceId,
    topic: input.action,
    aggregateType: "quote",
    aggregateId: input.quote.id,
    dedupeKey: `${input.action}:${input.quote.id}:${occurrenceId}`,
    payload,
    createdAt: input.now,
    nextAttemptAt: input.now
  });
  await repositories.audit.append({
    id: input.createId(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: "quote",
    entityId: input.quote.id,
    requestId: input.quote.requestId,
    metadata: payload,
    createdAt: input.now
  });
  if (["quote.created", "quote.approved", "quote.rejected"].includes(input.action)) {
    const request = await repositories.serviceRequests.findById(input.quote.requestId);
    const assignment = await repositories.assignments.findById(input.quote.assignmentId);
    const created = input.action === "quote.created";
    if (request && assignment) await persistNotification(repositories, {
      userId: created ? request.riderId : assignment.mechanicId, type: input.action,
      title: created ? (request.serviceType === "periodic_maintenance" ? "Có báo giá bảo dưỡng cần duyệt" : request.serviceType === "emergency_rescue" ? "Có báo giá cứu hộ cần duyệt" : "Có báo giá cần duyệt") : input.action === "quote.approved" ? "Khách đã đồng ý báo giá" : "Khách đã từ chối báo giá",
      body: created ? "Xem các khoản phí và xác nhận trước khi thợ thực hiện bước tiếp theo." : "Mở yêu cầu để xem báo giá và trạng thái thanh toán hiện tại.",
      data: payload, dedupeKey: `${input.action}:${input.quote.id}`, requestId: request.id
    }, input.now, input.createId);
  }
}

export function toQuoteResponse(quote: Quote): QuoteResponse {
  return {
    id: quote.id,
    request_id: quote.requestId,
    assignment_id: quote.assignmentId,
    purpose: quote.purpose ?? "standard",
    labor_pricing: quote.laborPricing,
    diagnosis_id: quote.diagnosisId,
    version: quote.version,
    status: quote.status,
    currency: quote.currency,
    subtotal_amount: quote.subtotalAmount,
    discount_amount: quote.discountAmount,
    total_amount: quote.totalAmount,
    notes: quote.notes,
    expires_at: quote.expiresAt?.toISOString(),
    created_by: quote.createdBy,
    created_at: quote.createdAt.toISOString(),
    responded_at: quote.respondedAt?.toISOString(),
    lines: quote.lines.map((line) => ({
      id: line.id,
      line_type: line.lineType,
      description: line.description,
      quantity: line.quantity,
      unit_amount: line.unitAmount,
      line_total_amount: line.lineTotalAmount,
      sort_order: line.sortOrder
    }))
  };
}
