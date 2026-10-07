import { randomUUID } from "node:crypto";
import { toPage, type Page } from "@/lib/list-pagination";

import type { ApiErrorCode } from "@/lib/api-error";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { requireActiveActor } from "@/features/auth/authorization";
import { persistNotification } from "@/features/notifications/notification.service";
import type { AuditActorRole } from "@/server/repositories/contracts/audit.repository";
import type {
  Assignment,
  AssignmentStatus
} from "@/server/repositories/contracts/assignment.repository";
import type { RequestStatus } from "@/server/repositories/contracts/service-request.repository";
import type { RescuePaymentTiming } from "@/server/repositories/contracts/quote.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { assertRequestStatusTransition } from "../service-requests/service-request-state";
import { assertAssignmentStatusTransition } from "./assignment-state";
import { assertNoAssignmentCommitment, CancellationConflict } from "./assignment-cancellation";
import { assignmentStatusInputSchema, assignmentListSchema, resolveAssignmentStatusFilter } from "./assignment.schemas";

export type AssignmentResponse = {
  id: string;
  request_id: string;
  mechanic_id: string;
  accepted_candidate_id: string | null;
  source: "offer" | "admin_manual" | "admin_reassignment";
  supersedes_assignment_id?: string;
  scheduled_start_at?: string;
  reservation_start_at?: string;
  reservation_end_at?: string;
  activated_at?: string;
  appointment_status?: "confirmed" | "active" | "completed" | "canceled";
  rescue_labor_quote_id?: string;
  rescue_payment_timing?: RescuePaymentTiming;
  maintenance_labor_quote_id?: string;
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

  listAssignments(identity: VerifiedSupabaseIdentity, input: unknown = {}): Promise<{ items: AssignmentResponse[]; page: Page }> {
    const parsed = assignmentListSchema.safeParse(input);
    if (!parsed.success) throw new AssignmentError("INVALID_INPUT", "List query is invalid.", 400);
    // `active_only=true` mà caller không truyền `status` → mở rộng sang list
    // status đang active. Có `status` rồi thì ưu tiên status đó.
    const statuses = resolveAssignmentStatusFilter({
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.active_only !== undefined ? { active_only: parsed.data.active_only } : {})
    });
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const assignments = await repositories.assignments.listVisibleToActor(
        {
          id: actor.id,
          roles: actor.roles.filter(isAuditActorRole)
        },
        { ...parsed.data, ...(statuses ? { statuses } : {}) }
      );
      return toPage(assignments, parsed.data.limit, toAssignmentResponse);
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
      let actor = await loadActiveActor(repositories, identity.subject);
      const snapshot = await repositories.assignments.findById(assignmentId);
      if (!snapshot) throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      const request = await repositories.serviceRequests.findByIdForUpdate(snapshot.requestId);
      if (!request) throw new CancellationConflict("request_missing");
      // Keep the mechanic lock before assignment locks, matching offer acceptance.
      if (parsed.data.status === "en_route" && snapshot.scheduledStartAt) {
        await repositories.mechanics.findProfileByUserIdForUpdate(snapshot.mechanicId);
      }
      const assignment = await repositories.assignments.findByIdForUpdate(assignmentId);
      if (!assignment) {
        throw new AssignmentError("NOT_FOUND", "Assignment not found.", 404);
      }
      actor = await loadActiveActor(repositories, identity.subject);
      const actorRole = primaryAuditRole(actor.roles);
      if (!actor.roles.includes("admin") && (!actor.roles.includes("mechanic") || assignment.mechanicId !== actor.id)) {
        throw new AssignmentError("FORBIDDEN", "Assigned mechanic or admin access is required.", 403);
      }
      if (assignment.status === parsed.data.status) {
        throw new AssignmentError("CONFLICT", "Assignment is already in the requested state.", 409);
      }
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      if (parsed.data.status === "canceled") {
        await assertNoAssignmentCommitment(repositories, assignment);
        if (!["accepted", "en_route", "on_site", "diagnosis"].includes(assignment.status)) throw new CancellationConflict("assignment_state");
        await repositories.dispatch.cancelOpenDispatchForRequest({ requestId: assignment.requestId, now });
      }
      const rescue = request?.serviceType === "emergency_rescue";
      const maintenance = request?.serviceType === "periodic_maintenance" && Boolean(assignment.maintenanceLaborQuoteId);
      if (request?.serviceType === "periodic_maintenance" && parsed.data.status === "en_route") {
        const labor = assignment.maintenanceLaborQuoteId ? await repositories.quotes.findById(assignment.maintenanceLaborQuoteId) : undefined;
        if (!labor || labor.status !== "approved" || labor.purpose !== "maintenance_labor") {
          throw new AssignmentError("CONFLICT", "Rider must approve maintenance labor before travel.", 409);
        }
      }
      if (rescue && parsed.data.status === "en_route") {
        const labor = assignment.rescueLaborQuoteId ? await repositories.quotes.findById(assignment.rescueLaborQuoteId) : undefined;
        if (!labor || labor.status !== "approved" || !assignment.rescuePaymentTiming) {
          throw new AssignmentError("CONFLICT", "Rider must approve rescue labor and choose payment timing before travel.", 409);
        }
        if (assignment.rescuePaymentTiming === "labor_upfront" && !await repositories.payments.hasSucceededForAssignment({ assignmentId: assignment.id, requestId: assignment.requestId, quoteId: labor.id })) {
          throw new AssignmentError("CONFLICT", "The agreed labor must be paid before travel.", 409);
        }
      }
      if (rescue && ["in_progress", "awaiting_payment", "completed"].includes(parsed.data.status)) {
        const finalQuote = await repositories.quotes.findLatestByRequestForUpdate(assignment.requestId);
        if (!finalQuote || finalQuote.assignmentId !== assignment.id || finalQuote.purpose !== "rescue_final" || finalQuote.status !== "approved") {
          throw new AssignmentError("CONFLICT", "An approved final rescue quote is required before repair.", 409);
        }
        const expectedSource = parsed.data.status === "in_progress" ? "diagnosis" : parsed.data.status === "awaiting_payment" ? "in_progress" : "awaiting_payment";
        if (assignment.status !== expectedSource) throw new AssignmentError("CONFLICT", "Rescue repair/payment steps must be completed in order.", 409);
        if (parsed.data.status === "completed" && await repositories.payments.sumSucceededForAssignment(assignment.id) < finalQuote.totalAmount) {
          throw new AssignmentError("CONFLICT", "Agreed labor and parts must be fully paid before closing rescue work.", 409);
        }
      }
      if (maintenance && ["in_progress", "awaiting_payment", "completed"].includes(parsed.data.status)) {
        const latest = await repositories.quotes.findLatestByRequestForUpdate(assignment.requestId);
        const approved = await repositories.quotes.findLatestApprovedByAssignment(assignment.id, "maintenance_work");
        if (!approved || latest?.status === "pending") throw new AssignmentError("CONFLICT", "Approved maintenance work with no pending additions is required.", 409);
        const source = parsed.data.status === "in_progress" ? "diagnosis" : parsed.data.status === "awaiting_payment" ? "in_progress" : "awaiting_payment";
        if (assignment.status !== source) throw new AssignmentError("CONFLICT", "Maintenance work/payment steps must be completed in order.", 409);
        if (parsed.data.status === "awaiting_payment") {
          const checklist = await repositories.mechanicOperations.getLatestAssignmentCompletionChecklist(assignment.id);
          if (!checklist || checklist.approvedQuoteId !== approved.id) throw new AssignmentError("CONFLICT", "Submit a completion checklist for the latest approved maintenance work.", 409);
        }
        if (parsed.data.status === "completed" && await repositories.payments.sumSucceededForAssignment(assignment.id) < approved.totalAmount) {
          throw new AssignmentError("CONFLICT", "Approved maintenance work must be fully paid before closing.", 409);
        }
      }

      if (parsed.data.status === "quoted" || parsed.data.status === "accepted" || (assignment.status === "quoted" && parsed.data.status === "diagnosis") || (parsed.data.status === "awaiting_payment" && !rescue && !maintenance)) {
        throw new AssignmentError(
          "CONFLICT",
          "This assignment transition requires its authorized quote or payment workflow.",
          409
        );
      }
      if (!rescue && !maintenance && parsed.data.status === "completed" && assignment.status !== "in_progress") {
        throw new AssignmentError("CONFLICT", "Standard work must start before completion.", 409);
      }
      if (parsed.data.status === "in_progress" && !rescue && !maintenance) {
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

      if (assignment.scheduledStartAt && !assignment.activatedAt && !["canceled", "en_route"].includes(parsed.data.status)) {
        throw new AssignmentError("CONFLICT", "Scheduled work must begin with travel in its preparation window.", 409);
      }
      if (parsed.data.status === "en_route" && assignment.scheduledStartAt && !assignment.activatedAt) {
        if (!request.serviceLocation) throw new AssignmentError("CONFLICT", "location is missing; administrative review is required.", 409);
        if (now > assignment.scheduledStartAt) {
          throw new AssignmentError("CONFLICT", "The appointment start has passed; administrative review is required.", 409);
        }
        if (!assignment.reservationStartAt || now < assignment.reservationStartAt) {
          throw new AssignmentError("CONFLICT", "The appointment preparation window has not started.", 409);
        }
        const mechanic = await repositories.mechanics.findProfileByUserIdForUpdate(assignment.mechanicId);
        if (!mechanic || mechanic.profileStatus !== "active") throw new AssignmentError("CONFLICT", "Mechanic is not active.", 409);
        const currentMechanic = await loadActiveActor(repositories, assignment.mechanicId);
        if (!currentMechanic.roles.includes("mechanic")) throw new AssignmentError("CONFLICT", "Mechanic role is no longer active.", 409);
        if (await repositories.assignments.findActiveByMechanicForUpdate(assignment.mechanicId)) {
          throw new AssignmentError("CONFLICT", "Finish the current job before starting this appointment.", 409);
        }
        await repositories.assignments.activate({ id: assignment.id, now });
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
      if (request && ["en_route", "canceled"].includes(updated.status)) await persistNotification(repositories, {
        userId: request.riderId, type: `assignment.${updated.status}`,
        title: updated.status === "en_route" ? "Thợ đang đến" : "Công việc đã bị hủy",
        body: updated.status === "en_route" ? "Thợ đã bắt đầu di chuyển đến vị trí phục vụ." : "Mở yêu cầu để xem trạng thái và liên hệ hỗ trợ.",
        data: { request_id: request.id, assignment_id: updated.id },
        dedupeKey: `assignment.${updated.status}:${updated.id}`, requestId: request.id
      }, now, createId);
      if (rescue && request && ["awaiting_payment", "completed"].includes(updated.status)) await persistNotification(repositories, {
        userId: request.riderId, type: `rescue.${updated.status}`,
        title: updated.status === "awaiting_payment" ? "Thợ đã sửa xong" : "Yêu cầu cứu hộ đã hoàn tất",
        body: updated.status === "awaiting_payment" ? "Kiểm tra tổng phí và thanh toán khoản còn lại nếu có." : "Bạn có thể đánh giá thợ cho yêu cầu này.",
        data: { request_id: request.id, assignment_id: updated.id }, dedupeKey: `rescue.${updated.status}:${updated.id}`, requestId: request.id
      }, now, createId);
      if (maintenance && request && ["awaiting_payment", "completed"].includes(updated.status)) await persistNotification(repositories, {
        userId: request.riderId, type: `maintenance.${updated.status}`,
        title: updated.status === "awaiting_payment" ? "Bảo dưỡng đã thực hiện xong" : "Yêu cầu bảo dưỡng đã hoàn tất",
        body: updated.status === "awaiting_payment" ? "Xem checklist và thanh toán tổng phí đã duyệt." : "Bạn có thể đánh giá thợ cho yêu cầu này.",
        data: { request_id: request.id, assignment_id: updated.id }, dedupeKey: `maintenance.${updated.status}:${updated.id}`, requestId: request.id
      }, now, createId);
      if (!rescue && !maintenance && request && updated.status === "completed") await persistNotification(repositories, {
        userId: request.riderId, type: "assignment.completed", title: "Yêu cầu đã hoàn tất",
        body: "Bạn có thể đánh giá thợ cho yêu cầu này.", data: { request_id: request.id, assignment_id: updated.id },
        dedupeKey: `assignment.completed:${updated.id}`, requestId: request.id
      }, now, createId);
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
  if (!request) throw new CancellationConflict("request_missing");
  if (request.status === requestStatus) {
    return;
  }
  try {
    assertRequestStatusTransition(request.status, requestStatus);
  } catch {
    throw new CancellationConflict("request_state");
  }
  const updated = await repositories.serviceRequests.updateStatus({
    id: request.id,
    status: requestStatus,
    updatedAt: input.now
  });
  if (!updated) throw new CancellationConflict("request_missing");
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
    accepted_candidate_id: assignment.acceptedCandidateId ?? null,
    source: assignment.source ?? "offer",
    supersedes_assignment_id: assignment.supersedesAssignmentId,
    scheduled_start_at: assignment.scheduledStartAt?.toISOString(),
    reservation_start_at: assignment.reservationStartAt?.toISOString(),
    reservation_end_at: assignment.reservationEndAt?.toISOString(),
    activated_at: assignment.activatedAt?.toISOString(),
    ...(assignment.scheduledStartAt ? { appointment_status: assignment.status === "completed" ? "completed" as const
      : ["canceled", "recovery_canceled"].includes(assignment.status) ? "canceled" as const
      : assignment.activatedAt ? "active" as const : "confirmed" as const } : {}),
    rescue_labor_quote_id: assignment.rescueLaborQuoteId,
    rescue_payment_timing: assignment.rescuePaymentTiming,
    maintenance_labor_quote_id: assignment.maintenanceLaborQuoteId,
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
    case "in_progress":
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
