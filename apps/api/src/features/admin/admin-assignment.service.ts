import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { assertNoAssignmentCommitment, cancelUncommittedAssignment, CancellationConflict } from "@/features/assignments/assignment-cancellation";
import { AssignmentError, toAssignmentResponse } from "@/features/assignments/assignment.service";
import { assertAssignmentStatusTransition } from "@/features/assignments/assignment-state";
import { assertRequestStatusTransition } from "@/features/service-requests/service-request-state";
import { persistNotification } from "@/features/notifications/notification.service";
import { listQuerySchema, toPage } from "@/lib/list-pagination";
import type { Assignment } from "@/server/repositories/contracts/assignment.repository";
import type { ServiceRequest } from "@/server/repositories/contracts/service-request.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { loadActiveAdminActor } from "./admin.authorization";
import { adminInternalNoteMutationSchema, adminReasonSchema, adminUuidSchema } from "./admin.schemas";
import { prepareAdminCommand, recordAdminAction } from "./admin-command";

const mechanicCommand = adminReasonSchema.extend({ mechanic_id: z.string().uuid(), estimated_duration_minutes: z.number().int().min(15).max(480).optional() }).strict();
const stuckCommand = adminReasonSchema.extend({ action: z.enum(["cancel", "reassign", "investigate"]), mechanic_id: z.string().uuid().optional(),
  estimated_duration_minutes: z.number().int().min(15).max(480).optional(), note: z.string().trim().min(1).max(2000).optional() }).strict();
export type AdminAssignmentAction = "manual_assign" | "reassign" | "cancel" | "note" | "resolve_stuck";

export class AdminAssignmentService {
  constructor(private readonly unitOfWork: UnitOfWork, private readonly options: { now?: () => Date; createId?: () => string } = {}) {}

  async read(identity: VerifiedSupabaseIdentity, assignmentId: string, view: "detail" | "timeline", input: unknown = {}) {
    if (!adminUuidSchema.safeParse(assignmentId).success) throw new AssignmentError("INVALID_INPUT", "Assignment ID is invalid.", 400);
    const page = listQuerySchema.omit({ date_from: true, date_to: true }).strict().safeParse(input);
    if (!page.success || (view === "detail" && Object.keys(input as object).length)) throw new AssignmentError("INVALID_INPUT", "Query is invalid.", 400);
    return this.unitOfWork.execute(async (repositories) => {
      await loadActiveAdminActor(identity, repositories.users);
      const snapshot = await repositories.assignments.findById(assignmentId);
      if (!snapshot) throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      const request = await repositories.serviceRequests.findByIdForUpdate(snapshot.requestId);
      const assignment = await repositories.assignments.findByIdForUpdate(assignmentId);
      await loadActiveAdminActor(identity, repositories.users);
      if (!assignment || !request) throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      if (view === "timeline") {
        const history = await repositories.assignments.listHistory(assignmentId, page.data.limit, page.data.cursor);
        const audit = await repositories.audit.query({ ...page.data, entityType: "assignment", entityId: assignmentId, adminOnly: true });
        const rows = [...history.map((row) => ({ id: row.id, createdAt: row.createdAt, type: "status", from_status: row.fromStatus, to_status: row.toStatus, actor_id: row.actorId })),
          ...audit.map((row) => ({ id: row.id, createdAt: row.createdAt, type: "admin_action", action: row.action, actor_id: row.actorId }))]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
        return toPage(rows, page.data.limit, ({ createdAt, ...row }) => ({ ...row, created_at: createdAt.toISOString() }));
      }
      const reasons = await assignmentBlockers(repositories, assignment);
      const cancelReasons = await assignmentBlockers(repositories, assignment, true);
      const expected = assignment.status === "accepted" ? "assigned" : assignment.status === "en_route" ? "mechanic_en_route" :
        assignment.status === "quoted" ? "awaiting_quote_approval" : assignment.status === "awaiting_payment" ? "awaiting_payment" : "in_service";
      if (!["completed", "canceled", "recovery_canceled"].includes(assignment.status) && request.status !== expected) reasons.push("request_state");
      return { ...toAssignmentResponse(assignment), request_status: request.status,
        work_slot: ["completed", "canceled", "recovery_canceled"].includes(assignment.status) ? "closed" : assignment.scheduledStartAt && !assignment.activatedAt ? "future_reservation" : "current",
        commitment_reason_codes: reasons, next_action_codes: ["add_note", "investigate",
          ...(!reasons.length && ["accepted", "en_route"].includes(assignment.status) ? ["reassign"] : []),
          ...(!cancelReasons.length && ["accepted", "en_route", "on_site", "diagnosis", "quoted"].includes(assignment.status) && request.status === expected ? ["cancel"] : [])] };
    });
  }

  async command(identity: VerifiedSupabaseIdentity, resourceId: string, action: AdminAssignmentAction, input: unknown, key: string) {
    if (!adminUuidSchema.safeParse(resourceId).success) throw new AssignmentError("INVALID_INPUT", "Resource ID is invalid.", 400);
    const schema = action === "manual_assign" || action === "reassign" ? mechanicCommand : action === "note" ? adminInternalNoteMutationSchema : action === "resolve_stuck" ? stuckCommand : adminReasonSchema;
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new AssignmentError("INVALID_INPUT", "Admin assignment command is invalid.", 400);
    const body = parsed.data as { reason: string; mechanic_id?: string; estimated_duration_minutes?: number; action?: string; note?: string; note_text?: string };
    const effective = action === "resolve_stuck" ? body.action : action;
    if (effective === "reassign" && !body.mechanic_id) throw new AssignmentError("INVALID_INPUT", "mechanic_id is required.", 400);
    if (effective === "investigate" && !body.note) throw new AssignmentError("INVALID_INPUT", "Investigation note is required.", 400);
    return this.unitOfWork.execute(async (repositories) => {
      let actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.options.now?.() ?? new Date(); const createId = this.options.createId ?? randomUUID;
      const snapshot = action === "manual_assign" ? undefined : await repositories.assignments.findById(resourceId);
      if (action !== "manual_assign" && !snapshot) throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      const request = await repositories.serviceRequests.findByIdForUpdate(snapshot?.requestId ?? resourceId);
      if (!request) throw new AssignmentError("NOT_FOUND", "Request not found.", 404);
      actor = await loadActiveAdminActor(identity, repositories.users);
      const scope = `admin.assignment.${action}:${resourceId}`;
      const replay = await prepareAdminCommand(repositories, actor.id, scope, key, body, now, createId);
      if (replay) return replay;
      const rounds = await repositories.dispatch.listRoundsByRequestForUpdate(request.id);
      let assignment = snapshot ? await repositories.assignments.findByIdForUpdate(snapshot.id) : undefined;
      actor = await loadActiveAdminActor(identity, repositories.users);
      if (snapshot && !assignment) throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      let response: Record<string, unknown>;
      if (effective === "note" || effective === "investigate") {
        const note = await repositories.adminInternalNotes.create({ id: createId(), adminId: actor.id, assignmentId: assignment!.id,
          noteText: (body.note_text ?? body.note)!, createdAt: now });
        response = { id: note.id, assignment_id: assignment!.id, status: effective === "investigate" ? "investigation_recorded" : "note_added", created_at: now.toISOString() };
      } else {
        if (rounds.some((row) => row.leaseExpiresAt && row.leaseExpiresAt > now)) throw new CancellationConflict("worker_lease_active");
        if (assignment) await assertNoAssignmentCommitment(repositories, assignment, effective === "cancel");
        if (effective === "cancel") {
          const expected = assignment!.status === "accepted" ? "assigned" : assignment!.status === "en_route" ? "mechanic_en_route" : assignment!.status === "quoted" ? "awaiting_quote_approval" : "in_service";
          if (request.status !== expected) throw new CancellationConflict("request_state");
          assignment = await cancelUncommittedAssignment(repositories, assignment!, { actorId: actor.id, actorRole: "admin", reason: "admin_assignment_cancel", now, createId, allowClosedQuotes: true });
          await changeRequest(repositories, request, "canceled", actor.id, now, createId, "admin_assignment_cancel");
          await repositories.dispatch.cancelOpenDispatchForRequest({ requestId: request.id, now });
        } else {
          if (effective === "reassign") {
            if (!assignment || !["accepted", "en_route"].includes(assignment.status) || request.status !== (assignment.status === "accepted" ? "assigned" : "mechanic_en_route")) throw new CancellationConflict("assignment_state");
            if (assignment.mechanicId === body.mechanic_id) throw new CancellationConflict("same_mechanic");
          } else if (!["submitted", "dispatching", "offered", "manual_escalation"].includes(request.status)) throw new CancellationConflict("request_state");
          if (effective === "manual_assign" && await repositories.assignments.findActiveByRequestForUpdate(request.id)) throw new CancellationConflict("assignment_exists");
          if (await repositories.payments.hasUnresolvedForRequest({ requestId: request.id })) throw new CancellationConflict("payment_unresolved");
          if (await repositories.quotes.hasOpenByRequest(request.id)) throw new CancellationConflict("quote_commitment");
          if (!request.serviceLocation) throw new CancellationConflict("location_required");
          if (request.scheduledStartAt && request.scheduledStartAt <= now) throw new CancellationConflict("appointment_passed");
          if (request.scheduledStartAt && body.estimated_duration_minutes === undefined) throw new AssignmentError("INVALID_INPUT", "Scheduled visits require estimated_duration_minutes.", 400);
          const target = body.mechanic_id!;
          if (!await repositories.mechanics.findProfileByUserIdForUpdate(target)) throw new CancellationConflict("mechanic_ineligible");
          actor = await loadActiveAdminActor(identity, repositories.users);
          const rider = await repositories.users.findActorById(request.riderId);
          const motorcycle = await repositories.motorcycles.findById(request.motorcycleId);
          if (rider?.status !== "active" || !rider.roles.includes("rider") || !motorcycle || motorcycle.riderId !== request.riderId || motorcycle.archivedAt) throw new CancellationConflict("rider_or_motorcycle_ineligible");
          const [eligible] = await repositories.dispatch.listEligibility({ serviceType: request.serviceType, origin: request.serviceLocation,
            requestId: request.id, radiusMeters: 12_000, now, maxLocationAgeSeconds: 300, scheduledStartAt: request.scheduledStartAt, targetMechanicId: target, limit: 1 });
          if (!eligible || eligible.reasonCodes.length) throw new CancellationConflict(eligible?.reasonCodes[0] ?? "mechanic_ineligible");
          const start = request.scheduledStartAt ? new Date(request.scheduledStartAt.getTime() - 30 * 60_000) : now;
          const end = new Date((request.scheduledStartAt ?? now).getTime() + ((body.estimated_duration_minutes ?? 120) + 30) * 60_000);
          if (await repositories.assignments.findReservationConflict({ mechanicId: target, start, end })) throw new CancellationConflict("reservation_conflict");
          const previous = assignment;
          if (previous) {
            assertAssignmentStatusTransition(previous.status, "recovery_canceled");
            await repositories.assignments.updateStatus({ id: previous.id, status: "recovery_canceled", canceledAt: now, updatedAt: now });
            await repositories.assignments.appendStatusHistory({ id: createId(), assignmentId: previous.id, fromStatus: previous.status,
              toStatus: "recovery_canceled", actorId: actor.id, actorRole: "admin", reason: "admin_reassigned", createdAt: now });
            await changeRequest(repositories, request, "submitted", actor.id, now, createId, "admin_reassigned");
            request.status = "submitted";
            await notify(repositories, previous.mechanicId, previous, "assignment.reassigned", now, createId);
          }
          await repositories.dispatch.cancelOpenDispatchForRequest({ requestId: request.id, now });
          assignment = await repositories.assignments.create({ id: createId(), requestId: request.id, mechanicId: target,
            source: previous ? "admin_reassignment" : "admin_manual", assignedByAdminId: actor.id, supersedesAssignmentId: previous?.id,
            dispatchDistanceMeters: eligible.distanceMeters, scheduledStartAt: request.scheduledStartAt, reservationStartAt: start, reservationEndAt: end,
            acceptedAt: now, createdAt: now, updatedAt: now });
          await repositories.assignments.appendStatusHistory({ id: createId(), assignmentId: assignment.id, toStatus: "accepted", actorId: actor.id,
            actorRole: "admin", reason: previous ? "admin_reassignment" : "admin_manual_assignment", createdAt: now });
          await changeRequest(repositories, request, "assigned", actor.id, now, createId, "admin_assignment_created");
          await notify(repositories, target, assignment, "assignment.admin_assigned", now, createId);
        }
        await notify(repositories, request.riderId, assignment!, effective === "cancel" ? "assignment.canceled" : "assignment.admin_assigned", now, createId);
        response = toAssignmentResponse(assignment!);
      }
      await recordAdminAction(repositories, { actorId: actor.id, action: `admin.assignment.${action}`, entityType: "assignment", entityId: assignment?.id ?? resourceId,
        requestId: request.id, reason: body.reason, now, createId, metadata: { assignment_id: assignment?.id ?? resourceId, request_id: request.id, change: effective } });
      await repositories.idempotency.complete({ actorId: actor.id, scope, idempotencyKey: key, responseStatus: ["manual_assign", "reassign", "note"].includes(action) ? 201 : 200,
        responseBody: response, resourceType: "assignment", resourceId: assignment?.id ?? resourceId, completedAt: now });
      return response;
    });
  }
}

async function assignmentBlockers(repositories: FoundationRepositories, assignment: Assignment, allowClosedQuotes = false): Promise<string[]> {
  const reasons: string[] = [];
  if (["in_progress", "completed"].includes(assignment.status) || (assignment.status === "accepted" && assignment.startedAt)) reasons.push("work_started");
  if (["canceled", "recovery_canceled"].includes(assignment.status)) reasons.push("assignment_terminal");
  if (assignment.rescueLaborQuoteId || assignment.maintenanceLaborQuoteId) reasons.push("agreement_exists");
  if (allowClosedQuotes ? await repositories.quotes.hasOpenByAssignment(assignment.id) : await repositories.quotes.hasAnyByAssignment(assignment.id)) reasons.push("quote_already_issued");
  if (await repositories.payments.hasUnresolvedForRequest({ requestId: assignment.requestId })) reasons.push("payment_unresolved");
  return reasons;
}

async function changeRequest(repositories: FoundationRepositories, request: ServiceRequest, status: ServiceRequest["status"], actorId: string, now: Date, createId: () => string, reason: string) {
  assertRequestStatusTransition(request.status, status);
  await repositories.serviceRequests.updateStatus({ id: request.id, status, updatedAt: now });
  await repositories.serviceRequests.appendStatusHistory({ id: createId(), requestId: request.id, fromStatus: request.status, toStatus: status, actorId, reason, createdAt: now });
}

async function notify(repositories: FoundationRepositories, userId: string, assignment: Assignment, type: string, now: Date, createId: () => string) {
  await persistNotification(repositories, { userId, type, title: "Cập nhật công việc", body: "Mở yêu cầu để kiểm tra thay đổi phân công.",
    data: { assignment_id: assignment.id, request_id: assignment.requestId }, dedupeKey: `${type}:${assignment.id}:${userId}`, requestId: assignment.requestId }, now, createId);
}
