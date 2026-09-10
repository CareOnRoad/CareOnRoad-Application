import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import {
  appendAssignmentAuditOutbox,
  loadActiveActor,
  primaryAuditRole
} from "@/features/assignments/assignment.service";
import { assertAssignmentStatusTransition } from "@/features/assignments/assignment-state";
import { assertRequestStatusTransition } from "@/features/service-requests/service-request-state";
import type { Quote, QuoteStatus } from "@/server/repositories/contracts/quote.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import {
  calculateQuote,
  MAX_QUOTE_AMOUNT,
  QuoteCalculationError
} from "./quote-calculator";
import { quoteInputSchema } from "./quote.schemas";

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

    let calculated;
    try {
      calculated = calculateQuote(parsed.data.lines, parsed.data.discount_amount);
    } catch (error) {
      if (error instanceof QuoteCalculationError) {
        throw new QuoteError("INVALID_INPUT", error.message, 400);
      }
      throw error;
    }

    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
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

      const request = await repositories.serviceRequests.findByIdForUpdate(requestId);
      if (!request) {
        throw new QuoteError("NOT_FOUND", "Service request not found.", 404);
      }
      const latest = await repositories.quotes.findLatestByRequestForUpdate(requestId);
      const firstVersion = !latest;
      if (
        firstVersion
          ? assignment.status !== "diagnosis" || request.status !== "in_service"
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

      const now = this.options.now?.() ?? new Date();
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
        diagnosisId: parsed.data.diagnosis_id,
        version: (latest?.version ?? 0) + 1,
        subtotalAmount: calculated.subtotal_amount,
        discountAmount: calculated.discount_amount,
        totalAmount: calculated.total_amount,
        notes: parsed.data.notes,
        expiresAt: parsed.data.expires_at
          ? new Date(parsed.data.expires_at)
          : undefined,
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

      if (firstVersion) {
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
      const assignments = await repositories.assignments.listVisibleToActor({
        id: actor.id,
        roles: actor.roles.filter(
          (role): role is "rider" | "mechanic" | "admin" =>
            role === "rider" || role === "mechanic" || role === "admin"
        )
      });
      if (
        !actor.roles.includes("admin") &&
        request.riderId !== actor.id &&
        !assignments.some((assignment) => assignment.requestId === requestId)
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
    quoteId: string
  ): Promise<QuoteResponse> {
    return this.decideQuote(identity, quoteId, "approved");
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
    decision: "approved" | "rejected"
  ): Promise<QuoteResponse> {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const initial = await repositories.quotes.findById(quoteId);
      if (!initial) {
        throw new QuoteError("NOT_FOUND", "Quote not found.", 404);
      }
      const assignment = await repositories.assignments.findByIdForUpdate(
        initial.assignmentId
      );
      const request = await repositories.serviceRequests.findByIdForUpdate(
        initial.requestId
      );
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
      if (
        assignment.status !== "quoted" ||
        request.status !== "awaiting_quote_approval"
      ) {
        throw new QuoteError("CONFLICT", "Quote workflow state is not valid.", 409);
      }

      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const updated = await repositories.quotes.updateStatus({
        id: quote.id,
        status: decision,
        respondedAt: now
      });
      if (!updated) {
        throw new QuoteError("NOT_FOUND", "Quote not found.", 404);
      }

      if (decision === "approved") {
        await transitionWorkflow(repositories, {
          assignment,
          request,
          assignmentStatus: "awaiting_payment",
          requestStatus: "awaiting_payment",
          actorId: actor.id,
          actorRole: "rider",
          now,
          createId,
          reason: "quote_approved"
        });
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

async function transitionWorkflow(
  repositories: FoundationRepositories,
  input: {
    assignment: Awaited<ReturnType<FoundationRepositories["assignments"]["findById"]>> &
      object;
    request: Awaited<ReturnType<FoundationRepositories["serviceRequests"]["findById"]>> &
      object;
    assignmentStatus: "quoted" | "awaiting_payment";
    requestStatus: "awaiting_quote_approval" | "awaiting_payment";
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
    updatedAt: input.now
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
}

export function toQuoteResponse(quote: Quote): QuoteResponse {
  return {
    id: quote.id,
    request_id: quote.requestId,
    assignment_id: quote.assignmentId,
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
