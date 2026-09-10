import { randomUUID } from "node:crypto";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { requireActorRole } from "@/features/auth/authorization";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { assertRequestStatusTransition } from "../service-requests/service-request-state";
import {
  appendAssignmentAuditOutbox,
  AssignmentError,
  loadActiveActor,
  toAssignmentResponse,
  type AssignmentResponse,
  primaryAuditRole
} from "./assignment.service";

export type AcceptAssignmentServiceOptions = {
  now?: () => Date;
  createId?: () => string;
};

export class AcceptAssignmentService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: AcceptAssignmentServiceOptions = {}
  ) {}

  acceptOffer(identity: VerifiedSupabaseIdentity, offerId: string): Promise<AssignmentResponse> {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      requireActorRole(
        {
          id: actor.id,
          ...(actor.displayName ? { display_name: actor.displayName } : {}),
          roles: actor.roles,
          status: actor.status
        },
        "mechanic"
      );

      const candidateSnapshot = await repositories.dispatch.findCandidateById(offerId);
      if (!candidateSnapshot) {
        throw new AssignmentError("NOT_FOUND", "Dispatch offer not found.", 404);
      }
      if (candidateSnapshot.mechanicId !== actor.id) {
        throw new AssignmentError("FORBIDDEN", "Dispatch offer is not assigned to this mechanic.", 403);
      }

      const request = await repositories.serviceRequests.findByIdForUpdate(
        candidateSnapshot.requestId
      );
      if (!request) {
        throw new AssignmentError("NOT_FOUND", "Service request not found.", 404);
      }
      const rounds = await repositories.dispatch.listRoundsByRequestForUpdate(request.id);
      const candidate = await repositories.dispatch.findCandidateByIdForUpdate(offerId);
      if (!candidate || candidate.requestId !== request.id) {
        throw new AssignmentError("NOT_FOUND", "Dispatch offer not found.", 404);
      }
      if (candidate.mechanicId !== actor.id) {
        throw new AssignmentError("FORBIDDEN", "Dispatch offer is not assigned to this mechanic.", 403);
      }

      const existingForCandidate = await repositories.assignments.findByAcceptedCandidate(
        candidate.id
      );
      if (candidate.status === "accepted" && existingForCandidate) {
        return toAssignmentResponse(existingForCandidate);
      }

      const now = this.options.now?.() ?? new Date();
      if (candidate.status !== "offered") {
        throw new AssignmentError("CONFLICT", "Dispatch offer is not open.", 409);
      }
      if (!candidate.expiresAt || candidate.expiresAt.getTime() <= now.getTime()) {
        throw new AssignmentError("CONFLICT", "Dispatch offer has expired.", 409);
      }
      if (request.status !== "offered") {
        throw new AssignmentError("CONFLICT", "Service request is not accepting dispatch offers.", 409);
      }
      if (!rounds.some((round) => round.id === candidate.roundId && round.status === "active")) {
        throw new AssignmentError("CONFLICT", "Dispatch round is not active.", 409);
      }

      const mechanic = await repositories.mechanics.findProfileByUserIdForUpdate(actor.id);
      if (!mechanic || mechanic.profileStatus !== "active") {
        throw new AssignmentError("CONFLICT", "Mechanic profile is not active.", 409);
      }
      const requestConflict = await repositories.assignments.findActiveByRequestForUpdate(
        request.id
      );
      if (requestConflict) {
        throw new AssignmentError("CONFLICT", "The service request already has an active assignment.", 409);
      }
      const mechanicConflict = await repositories.assignments.findActiveByMechanicForUpdate(
        actor.id
      );
      if (mechanicConflict) {
        throw new AssignmentError("CONFLICT", "The mechanic already has an active assignment.", 409);
      }

      const createId = this.options.createId ?? randomUUID;
      const acceptedCandidate = await repositories.dispatch.updateCandidateStatus({
        id: candidate.id,
        status: "accepted",
        respondedAt: now
      });
      if (!acceptedCandidate) {
        throw new AssignmentError("NOT_FOUND", "Dispatch offer not found.", 404);
      }

      const assignment = await repositories.assignments.create({
        id: createId(),
        requestId: request.id,
        mechanicId: actor.id,
        acceptedCandidateId: acceptedCandidate.id,
        status: "accepted",
        acceptedAt: now,
        createdAt: now,
        updatedAt: now
      });
      await repositories.assignments.appendStatusHistory({
        id: createId(),
        assignmentId: assignment.id,
        toStatus: "accepted",
        actorId: actor.id,
        actorRole: "mechanic",
        reason: "offer_accepted",
        createdAt: now
      });

      await repositories.dispatch.updateOtherCandidatesForRequestStatus({
        requestId: request.id,
        exceptCandidateId: acceptedCandidate.id,
        fromStatuses: ["offered", "pending"],
        status: "cancelled",
        respondedAt: now
      });
      await repositories.dispatch.updateRoundStatus({
        id: candidate.roundId,
        status: "accepted",
        completedAt: now
      });

      assertRequestStatusTransition(request.status, "assigned");
      await repositories.serviceRequests.updateStatus({
        id: request.id,
        status: "assigned",
        updatedAt: now
      });
      await repositories.serviceRequests.appendStatusHistory({
        id: createId(),
        requestId: request.id,
        fromStatus: request.status,
        toStatus: "assigned",
        actorId: actor.id,
        reason: "offer_accepted",
        createdAt: now
      });

      await appendAssignmentAuditOutbox({
        action: "assignment.accepted",
        assignment,
        actorId: actor.id,
        actorRole: primaryAuditRole(actor.roles),
        audit: repositories.audit,
        outbox: repositories.outbox,
        now,
        createId,
        extraPayload: {
          accepted_candidate_id: acceptedCandidate.id,
          canceled_competing_candidates: true
        }
      });

      return toAssignmentResponse(assignment);
    });
  }
}
