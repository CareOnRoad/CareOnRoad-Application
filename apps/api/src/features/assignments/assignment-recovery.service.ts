import { randomUUID } from "node:crypto";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { requireActiveActor } from "@/features/auth/authorization";
import { prepareIdempotency } from "@/lib/idempotency";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { assertAssignmentStatusTransition } from "./assignment-state";
import { AssignmentError, primaryAuditRole } from "./assignment.service";
import {
  assignmentRecoveryInputSchema,
  type AssignmentRecoveryReason
} from "./assignment-recovery.schemas";
import { assertRequestStatusTransition } from "../service-requests/service-request-state";
import { assertNoAssignmentCommitment, CancellationConflict } from "./assignment-cancellation";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type AssignmentRecoveryResponse = {
  assignment_id: string;
  request_id: string;
  status: "recovery_canceled";
  reason_code: AssignmentRecoveryReason;
  redispatch_status: "queued";
  recovered_at: string;
};

export class AssignmentRecoveryService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  async recover(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AssignmentRecoveryResponse> {
    const key = idempotencyKey.trim();
    if (key.length < 8 || key.length > 200) {
      throw new AssignmentError("INVALID_INPUT", "X-Idempotency-Key is required.", 400);
    }
    const parsed = assignmentRecoveryInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new AssignmentError("INVALID_INPUT", "Assignment recovery input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }
    const now = this.options.now?.() ?? new Date();
    const createId = this.options.createId ?? randomUUID;

    return this.unitOfWork.execute(async (repositories) => {
      await loadRecoveryActor(repositories, identity.subject);
      const snapshot = await repositories.assignments.findById(assignmentId);
      if (!snapshot) {
        throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      }
      const request = await repositories.serviceRequests.findByIdForUpdate(snapshot.requestId);
      if (!request) {
        throw new AssignmentError("NOT_FOUND", "Service request not found.", 404);
      }
      const assignment = await repositories.assignments.findByIdForUpdate(assignmentId);
      if (!assignment) throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      const actor = await loadRecoveryActor(repositories, identity.subject);
      authorizeRecovery(actor, assignment.mechanicId, parsed.data.reason_code);

      const scope = `POST /api/v1/assignments/${assignment.id}/recover`;
      const decision = await prepareIdempotency(repositories.idempotency, {
        actorId: actor.id,
        scope,
        idempotencyKey: key,
        request: parsed.data,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        id: createId()
      });
      if (decision.action === "conflict") {
        throw new AssignmentError("CONFLICT", "Idempotency key payload mismatch.", 409);
      }
      if (decision.action === "in_progress") {
        throw new AssignmentError("CONFLICT", "Idempotency key is already in progress.", 409);
      }
      if (decision.action === "replay") {
        return decision.responseBody as AssignmentRecoveryResponse;
      }
      await assertNoAssignmentCommitment(repositories, assignment);

      if (!["accepted", "en_route"].includes(assignment.status)) {
        throw new CancellationConflict("assignment_state");
      }
      const expectedRequestStatus = assignment.status === "accepted" ? "assigned" : "mechanic_en_route";
      if (request.status !== expectedRequestStatus) {
        throw new CancellationConflict("request_state");
      }
      assertAssignmentStatusTransition(assignment.status, "recovery_canceled");
      assertRequestStatusTransition(request.status, "submitted");

      await repositories.dispatch.cancelOpenDispatchForRequest({ requestId: request.id, now });
      const recovered = await repositories.assignments.updateStatus({
        id: assignment.id,
        status: "recovery_canceled",
        updatedAt: now,
        canceledAt: now
      });
      if (!recovered) throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      await repositories.assignments.appendStatusHistory({
        id: createId(),
        assignmentId: assignment.id,
        fromStatus: assignment.status,
        toStatus: "recovery_canceled",
        actorId: actor.id,
        actorRole: primaryAuditRole(actor.roles),
        reason: parsed.data.reason_code,
        createdAt: now
      });
      const updatedRequest = await repositories.serviceRequests.updateStatus({
        id: request.id,
        status: "submitted",
        updatedAt: now
      });
      if (!updatedRequest) throw new CancellationConflict("request_missing");
      await repositories.serviceRequests.appendStatusHistory({
        id: createId(),
        requestId: request.id,
        fromStatus: request.status,
        toStatus: "submitted",
        actorId: actor.id,
        reason: `assignment_recovery:${parsed.data.reason_code}`,
        createdAt: now
      });

      const payload = {
        assignment_id: assignment.id,
        request_id: request.id,
        mechanic_id: assignment.mechanicId,
        status: "recovery_canceled",
        reason_code: parsed.data.reason_code
      } as const;
      const eventId = createId();
      await repositories.outbox.append({
        id: eventId,
        topic: "assignment.recovery.requested",
        aggregateType: "assignment",
        aggregateId: assignment.id,
        dedupeKey: `assignment.recovery.requested:${assignment.id}`,
        payload,
        createdAt: now,
        nextAttemptAt: now
      });
      await repositories.audit.append({
        id: createId(),
        actorId: actor.id,
        actorRole: primaryAuditRole(actor.roles),
        action: "assignment.recovery.requested",
        entityType: "assignment",
        entityId: assignment.id,
        requestId: request.id,
        metadata: payload,
        createdAt: now
      });

      const response: AssignmentRecoveryResponse = {
        assignment_id: assignment.id,
        request_id: request.id,
        status: "recovery_canceled",
        reason_code: parsed.data.reason_code,
        redispatch_status: "queued",
        recovered_at: now.toISOString()
      };
      await repositories.idempotency.complete({
        actorId: actor.id,
        scope,
        idempotencyKey: key,
        responseStatus: 200,
        responseBody: response,
        resourceType: "assignment",
        resourceId: assignment.id,
        completedAt: now
      });
      return response;
    });
  }
}

async function loadRecoveryActor(repositories: FoundationRepositories, actorId: string) {
  const actor = await repositories.users.findActorById(actorId);
  if (!actor) throw new AssignmentError("NOT_FOUND", "Application profile not found.", 404);
  requireActiveActor({
    id: actor.id,
    ...(actor.displayName ? { display_name: actor.displayName } : {}),
    roles: actor.roles,
    status: actor.status
  });
  if (!actor.roles.includes("mechanic") && !actor.roles.includes("admin")) {
    throw new AssignmentError("FORBIDDEN", "Mechanic or admin access is required.", 403);
  }
  return actor;
}

function authorizeRecovery(
  actor: { id: string; roles: string[] },
  mechanicId: string,
  reason: AssignmentRecoveryReason
): void {
  if (actor.roles.includes("admin")) return;
  if (!actor.roles.includes("mechanic") || actor.id !== mechanicId) {
    throw new AssignmentError("FORBIDDEN", "Assigned mechanic or admin access is required.", 403);
  }
  if (reason !== "cannot_continue") {
    throw new AssignmentError("FORBIDDEN", "This recovery reason requires admin access.", 403);
  }
}
