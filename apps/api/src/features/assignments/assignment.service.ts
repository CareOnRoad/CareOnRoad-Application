import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { requireActiveActor } from "@/features/auth/authorization";
import type { AuditActorRole } from "@/server/repositories/contracts/audit.repository";
import type {
  Assignment,
  AssignmentStatus
} from "@/server/repositories/contracts/assignment.repository";
import type { RequestStatus } from "@/server/repositories/contracts/service-request.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { assertRequestStatusTransition } from "../service-requests/service-request-state";
import { assertAssignmentStatusTransition } from "./assignment-state";
import { assignmentStatusInputSchema } from "./assignment.schemas";

export type AssignmentResponse = {
  id: string;
  request_id: string;
  mechanic_id: string;
  accepted_candidate_id: string;
  status: AssignmentStatus;
  accepted_at: string;
  started_at?: string;
  completed_at?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
};

export type AssignmentServiceOptions = {
  now?: () => Date;
  createId?: () => string;
};

export class AssignmentService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: AssignmentServiceOptions = {}
  ) {}

  listAssignments(identity: VerifiedSupabaseIdentity): Promise<{ items: AssignmentResponse[] }> {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const assignments = await repositories.assignments.listVisibleToActor({
        id: actor.id,
        roles: actor.roles.filter(isAuditActorRole)
      });
      return { items: assignments.map(toAssignmentResponse) };
    });
  }

  transitionAssignment(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string,
    input: unknown
  ): Promise<AssignmentResponse> {
    const parsed = assignmentStatusInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new AssignmentError("INVALID_INPUT", "Assignment status input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }

    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const actorRole = primaryAuditRole(actor.roles);
      const assignment = await repositories.assignments.findByIdForUpdate(assignmentId);
      if (!assignment) {
        throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      }
      if (!actor.roles.includes("admin") && assignment.mechanicId !== actor.id) {
        throw new AssignmentError("FORBIDDEN", "Assigned mechanic or admin access is required.", 403);
      }
      if (assignment.status === parsed.data.status) {
        throw new AssignmentError("CONFLICT", "Assignment is already in the requested state.", 409);
      }
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;

      if (parsed.data.status === "quoted" || parsed.data.status === "awaiting_payment") {
        throw new AssignmentError(
          "CONFLICT",
          "This assignment transition requires its authorized quote or payment workflow.",
          409
        );
      }
      if (parsed.data.status === "in_progress") {
        if (assignment.status !== "awaiting_payment") {
          throw new AssignmentError(
            "CONFLICT",
            "This assignment transition requires its authorized payment workflow.",
            409
          );
        }
        const paymentVerified = await verifyPaymentBeforeStart(repositories, {
          assignment,
          actorId: actor.id,
          actorRole,
          now,
          createId
        });
        if (!paymentVerified) {
          throw new AssignmentError(
            "CONFLICT",
            "A succeeded payment is required before starting work.",
            409
          );
        }
      }
      try {
        assertAssignmentStatusTransition(assignment.status, parsed.data.status);
      } catch {
        throw new AssignmentError("CONFLICT", "Assignment status transition is not allowed.", 409);
      }

      const updated = await repositories.assignments.updateStatus({
        id: assignment.id,
        status: parsed.data.status,
        updatedAt: now,
        ...(parsed.data.status === "en_route" ? { startedAt: now } : {}),
        ...(parsed.data.status === "completed" ? { completedAt: now } : {}),
        ...(parsed.data.status === "canceled" ? { canceledAt: now } : {})
      });
      if (!updated) {
        throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      }

      await repositories.assignments.appendStatusHistory({
        id: createId(),
        assignmentId: assignment.id,
        fromStatus: assignment.status,
        toStatus: parsed.data.status,
        actorId: actor.id,
        actorRole,
        reason: parsed.data.reason,
        createdAt: now
      });
      await maybeUpdateRequestForAssignmentStatus(repositories, {
        assignment: updated,
        actorId: actor.id,
        fromAssignmentStatus: assignment.status,
        toAssignmentStatus: parsed.data.status,
        now,
        createId,
        reason: parsed.data.reason ?? `assignment_${parsed.data.status}`
      });
      await appendAssignmentAuditOutbox({
        action: "assignment.status_changed",
        assignment: updated,
        actorId: actor.id,
        actorRole,
        audit: repositories.audit,
        outbox: repositories.outbox,
        now,
        createId,
        extraPayload: {
          from_status: assignment.status,
          to_status: parsed.data.status
        }
      });
      return toAssignmentResponse(updated);
    });
  }
}

export class AssignmentError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "ACTOR_SUSPENDED"
    >,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AssignmentError";
  }
}

export async function loadActiveActor(repositories: FoundationRepositories, actorId: string) {
  const actor = await repositories.users.findActorById(actorId);
  if (!actor) {
    throw new AssignmentError("NOT_FOUND", "Application profile not found.", 404);
  }
  requireActiveActor({
    id: actor.id,
    ...(actor.displayName ? { display_name: actor.displayName } : {}),
    roles: actor.roles,
    status: actor.status
  });
  return actor;
}

export function primaryAuditRole(roles: string[]): AuditActorRole {
  if (roles.includes("admin")) {
    return "admin";
  }
  if (roles.includes("mechanic")) {
    return "mechanic";
  }
  return "rider";
}

export async function maybeUpdateRequestForAssignmentStatus(
  repositories: FoundationRepositories,
  input: {
    assignment: Assignment;
    actorId: string;
    fromAssignmentStatus: AssignmentStatus;
    toAssignmentStatus: AssignmentStatus;
    now: Date;
    createId: () => string;
    reason: string;
  }
): Promise<void> {
  const requestStatus = requestStatusForAssignmentStatus(input.toAssignmentStatus);
  if (!requestStatus) {
    return;
  }
  const request = await repositories.serviceRequests.findByIdForUpdate(input.assignment.requestId);
  if (!request || request.status === requestStatus) {
    return;
  }
  try {
    assertRequestStatusTransition(request.status, requestStatus);
  } catch {
    return;
  }
  await repositories.serviceRequests.updateStatus({
    id: request.id,
    status: requestStatus,
    updatedAt: input.now
  });
  await repositories.serviceRequests.appendStatusHistory({
    id: input.createId(),
    requestId: request.id,
    fromStatus: request.status,
    toStatus: requestStatus,
    actorId: input.actorId,
    reason: input.reason,
    createdAt: input.now
  });
}

export async function appendAssignmentAuditOutbox(input: {
  action: string;
  assignment: Assignment;
  actorId?: string;
  actorRole?: AuditActorRole;
  audit: FoundationRepositories["audit"];
  outbox: FoundationRepositories["outbox"];
  now: Date;
  createId: () => string;
  extraPayload?: Record<string, unknown>;
}): Promise<void> {
  const occurrenceId = input.createId();
  const payload = {
    assignment_id: input.assignment.id,
    request_id: input.assignment.requestId,
    mechanic_id: input.assignment.mechanicId,
    status: input.assignment.status,
    ...input.extraPayload
  };
  await input.outbox.append({
    id: occurrenceId,
    topic: input.action,
    aggregateType: "assignment",
    aggregateId: input.assignment.id,
    dedupeKey: `${input.action}:${input.assignment.id}:${occurrenceId}`,
    payload,
    createdAt: input.now,
    nextAttemptAt: input.now
  });
  await input.audit.append({
    id: input.createId(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: "assignment",
    entityId: input.assignment.id,
    requestId: input.assignment.requestId,
    metadata: payload,
    createdAt: input.now
  });
}

export function toAssignmentResponse(assignment: Assignment): AssignmentResponse {
  return {
    id: assignment.id,
    request_id: assignment.requestId,
    mechanic_id: assignment.mechanicId,
    accepted_candidate_id: assignment.acceptedCandidateId,
    status: assignment.status,
    accepted_at: assignment.acceptedAt.toISOString(),
    ...(assignment.startedAt ? { started_at: assignment.startedAt.toISOString() } : {}),
    ...(assignment.completedAt ? { completed_at: assignment.completedAt.toISOString() } : {}),
    ...(assignment.canceledAt ? { canceled_at: assignment.canceledAt.toISOString() } : {}),
    created_at: assignment.createdAt.toISOString(),
    updated_at: assignment.updatedAt.toISOString()
  };
}

function requestStatusForAssignmentStatus(status: AssignmentStatus): RequestStatus | undefined {
  switch (status) {
    case "en_route":
      return "mechanic_en_route";
    case "on_site":
      return "in_service";
    case "quoted":
      return "awaiting_quote_approval";
    case "awaiting_payment":
      return "awaiting_payment";
    case "completed":
      return "completed";
    case "canceled":
      return "canceled";
    case "recovery_canceled":
      return undefined;
    default:
      return undefined;
  }
}

function isAuditActorRole(role: string): role is AuditActorRole {
  return role === "rider" || role === "mechanic" || role === "admin";
}

async function verifyPaymentBeforeStart(
  repositories: FoundationRepositories,
  input: {
    assignment: Assignment;
    actorId: string;
    actorRole: AuditActorRole;
    now: Date;
    createId: () => string;
  }
): Promise<boolean> {
  const latestQuote = await repositories.quotes.findLatestByRequestForUpdate(
    input.assignment.requestId
  );
  if (!latestQuote || latestQuote.status !== "approved") {
    return false;
  }
  const paid = await repositories.payments.hasSucceededForAssignment({
    assignmentId: input.assignment.id,
    requestId: input.assignment.requestId,
    quoteId: latestQuote.id
  });
  if (!paid) {
    return false;
  }
  await appendAssignmentAuditOutbox({
    action: "assignment.payment_verified",
    assignment: input.assignment,
    actorId: input.actorId,
    actorRole: input.actorRole,
    audit: repositories.audit,
    outbox: repositories.outbox,
    now: input.now,
    createId: input.createId,
    extraPayload: {
      quote_id: latestQuote.id,
      reason_code: "payment_succeeded"
    }
  });
  return true;
}
