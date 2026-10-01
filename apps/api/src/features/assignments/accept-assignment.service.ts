import { randomUUID } from "node:crypto";
import { z } from "zod";
import { persistNotification } from "@/features/notifications/notification.service";

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

  acceptOffer(identity: VerifiedSupabaseIdentity, offerId: string, input: unknown = {}): Promise<AssignmentResponse> {
    const parsed = z.object({ estimated_duration_minutes: z.number().int().min(15).max(480).optional() }).strict().safeParse(input);
    if (!parsed.success) throw new AssignmentError("INVALID_INPUT", "Offer acceptance input is invalid.", 400);
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
      const scheduled = request.serviceType === "periodic_maintenance" ? request.scheduledStartAt : undefined;
      if (scheduled && parsed.data.estimated_duration_minutes === undefined) {
        throw new AssignmentError("INVALID_INPUT", "Scheduled maintenance requires estimated_duration_minutes.", 400);
      }
      if (scheduled && scheduled <= now) throw new AssignmentError("CONFLICT", "The appointment time has passed; reschedule the request.", 409);
      const visitStart = scheduled ?? now;
      const reservationStart = scheduled ? new Date(visitStart.getTime() - 30 * 60_000) : now;
      const reservationEnd = new Date(visitStart.getTime() + ((parsed.data.estimated_duration_minutes ?? 120) + 30) * 60_000);
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
      if (mechanicConflict && !scheduled) {
        throw new AssignmentError("CONFLICT", "The mechanic already has an active assignment.", 409);
      }

      if (await repositories.assignments.findReservationConflict({ mechanicId: actor.id, start: reservationStart, end: reservationEnd })) {
        throw new AssignmentError("CONFLICT", "This time overlaps another job or its travel buffer.", 409);
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
        scheduledStartAt: scheduled,
        reservationStartAt: reservationStart,
        reservationEndAt: reservationEnd,
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

      await persistNotification(repositories, {
        userId: request.riderId, type: scheduled ? "maintenance.booking.confirmed" : "assignment.accepted",
        title: scheduled ? "Lịch bảo dưỡng đã được xác nhận" : "Thợ đã nhận yêu cầu",
        body: scheduled ? "Thợ đã nhận lịch đến bảo dưỡng tại vị trí của bạn." : "Bạn có thể theo dõi tiến trình phục vụ.",
        data: { request_id: request.id, assignment_id: assignment.id,
          ...(scheduled ? { scheduled_start_at: scheduled.toISOString() } : {}) },
        dedupeKey: `assignment.accepted:${assignment.id}`, requestId: request.id
      }, now, createId);
      return toAssignmentResponse(assignment);
    });
  }
}
