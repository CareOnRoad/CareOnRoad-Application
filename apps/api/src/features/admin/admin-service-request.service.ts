import { randomUUID } from "node:crypto";
import { z } from "zod";
import { cancelUncommittedAssignment, CancellationConflict } from "@/features/assignments/assignment-cancellation";
import { assertRequestStatusTransition } from "@/features/service-requests/service-request-state";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { ApiErrorCode } from "@/lib/api-error";
import { prepareIdempotency } from "@/lib/idempotency";
import type {
  AdminRequestAssignmentSummary,
  AdminRequestCursor,
  AdminRequestMediaSummary,
  AdminRequestQuoteSummary,
  AdminRequestTimelineCursor,
  AdminRequestTimelineItem,
  AdminServiceRequestDetail,
  AdminServiceRequestSummary
} from "@/server/repositories/contracts/admin-query.repository";
import type { RequestStatus } from "@/server/repositories/contracts/service-request.repository";
import type {
  FoundationRepositories,
  UnitOfWork
} from "@/server/repositories/contracts/unit-of-work";

import { loadActiveAdminActor } from "./admin.authorization";
import {
  adminInternalNoteMutationSchema,
  adminPaginationSchema,
  adminReasonSchema,
  adminServiceRequestListFilterSchema,
  adminUuidSchema
} from "./admin.schemas";
import {
  canRunAdminRequestCommand,
  reconcileOpenDispatchForRequest,
  type AdminRequestCommand
} from "./admin-request-state";
import { sanitizeAdminReason } from "./admin-redaction";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const cancellationRepairInput = adminReasonSchema.extend({ assignment_id: z.string().uuid(), dry_run: z.boolean().default(true) }).strict();
export type CancellationRepairResponse = { request_id: string; assignment_id: string; dry_run: boolean; repairable: boolean; reason_code?: string; status: RequestStatus };
const reservationRepairInput = cancellationRepairInput.extend({ estimated_duration_minutes: z.number().int().min(15).max(480) }).strict();
export type ReservationRepairResponse = Omit<CancellationRepairResponse, "status"> & {
  scheduled_start_at?: string; reservation_start_at?: string; reservation_end_at?: string;
};

export type AdminServiceRequestSummaryResponse = {
  id: string;
  request_code: string;
  rider_id: string;
  motorcycle_id: string;
  service_type: AdminServiceRequestSummary["serviceType"];
  fulfillment_mode?: AdminServiceRequestSummary["fulfillmentMode"];
  status: RequestStatus;
  priority: AdminServiceRequestSummary["priority"];
  mechanic_id?: string;
  scheduled_start_at?: string;
  created_at: string;
  updated_at: string;
};

export type AdminServiceRequestDetailResponse =
  AdminServiceRequestSummaryResponse & {
    dispatch?: {
      round_id: string;
      round_number: number;
      status: string;
      started_at: string;
      expires_at: string;
      completed_at?: string;
      open_candidate_count: number;
    };
    assignment?: AdminRequestAssignmentResponse;
    latest_quote?: AdminRequestQuoteResponse;
    reminder?: {
      reminder_id: string;
      occurrence_id?: string;
    };
  };

export type AdminRequestAssignmentResponse = {
  id: string;
  request_id: string;
  mechanic_id: string;
  status: AdminRequestAssignmentSummary["status"];
  accepted_at: string;
  started_at?: string;
  completed_at?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
};

export type AdminRequestQuoteResponse = {
  id: string;
  request_id: string;
  assignment_id: string;
  version: number;
  status: AdminRequestQuoteSummary["status"];
  currency: "VND";
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  expires_at?: string;
  created_at: string;
  responded_at?: string;
};

export type AdminRequestTimelineResponse =
  | {
      id: string;
      kind: "status";
      from_status?: RequestStatus;
      to_status: RequestStatus;
      actor_id?: string;
      reason?: string;
      created_at: string;
    }
  | {
      id: string;
      kind: "internal_note";
      admin_id: string;
      note: string;
      created_at: string;
    };

export type AdminRequestMediaResponse = {
  id: string;
  request_id: string;
  media_type: string;
  content_type: string;
  size_bytes?: number;
  created_by: string;
  created_at: string;
};

export type AdminRequestNoteResponse = {
  id: string;
  request_id: string;
  admin_id: string;
  note: string;
  created_at: string;
};

export type AdminPageResponse<T> = {
  items: T[];
  page: {
    limit: number;
    has_more: boolean;
    next_cursor?: string;
  };
};

type ServiceOptions = {
  now?: () => Date;
  createId?: () => string;
};

export class AdminServiceRequestService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: ServiceOptions = {}
  ) {}

  listRequests(
    identity: VerifiedSupabaseIdentity,
    input: unknown
  ): Promise<AdminPageResponse<AdminServiceRequestSummaryResponse>> {
    const filters = parseListFilters(input);
    return this.unitOfWork.execute(async ({ adminQueries, users }) => {
      await loadActiveAdminActor(identity, users);
      const result = await adminQueries.listServiceRequests(filters);
      return toPage(
        result.items.map(toRequestSummaryResponse),
        filters.limit,
        result.nextCursor
      );
    });
  }

  getRequest(
    identity: VerifiedSupabaseIdentity,
    requestId: string
  ): Promise<AdminServiceRequestDetailResponse> {
    const id = parseUuid(requestId);
    return this.unitOfWork.execute(async ({ adminQueries, users }) => {
      await loadActiveAdminActor(identity, users);
      const detail = await adminQueries.getServiceRequestDetail(id);
      if (!detail) throw notFound();
      return toRequestDetailResponse(detail);
    });
  }

  listTimeline(
    identity: VerifiedSupabaseIdentity,
    requestId: string,
    input: unknown
  ): Promise<AdminPageResponse<AdminRequestTimelineResponse>> {
    const id = parseUuid(requestId);
    const pagination = parseTimelinePagination(input);
    return this.unitOfWork.execute(async ({
      adminQueries,
      serviceRequests,
      users
    }) => {
      await loadActiveAdminActor(identity, users);
      if (!(await serviceRequests.findById(id))) throw notFound();
      const result = await adminQueries.listRequestTimeline({
        requestId: id,
        limit: pagination.limit,
        ...(pagination.cursor ? { cursor: pagination.cursor } : {})
      });
      return toTimelinePage(
        result.items.map(toTimelineResponse),
        pagination.limit,
        result.nextCursor
      );
    });
  }

  listMedia(
    identity: VerifiedSupabaseIdentity,
    requestId: string,
    input: unknown
  ): Promise<AdminPageResponse<AdminRequestMediaResponse>> {
    const id = parseUuid(requestId);
    const pagination = parsePagination(input);
    return this.unitOfWork.execute(async ({
      adminQueries,
      serviceRequests,
      users
    }) => {
      await loadActiveAdminActor(identity, users);
      if (!(await serviceRequests.findById(id))) throw notFound();
      const result = await adminQueries.listRequestMedia({
        requestId: id,
        limit: pagination.limit,
        ...(pagination.cursor ? { cursor: pagination.cursor } : {})
      });
      return toPage(
        result.items.map(toMediaResponse),
        pagination.limit,
        result.nextCursor
      );
    });
  }

  getAssignment(
    identity: VerifiedSupabaseIdentity,
    requestId: string
  ): Promise<AdminRequestAssignmentResponse> {
    const id = parseUuid(requestId);
    return this.unitOfWork.execute(async ({
      adminQueries,
      serviceRequests,
      users
    }) => {
      await loadActiveAdminActor(identity, users);
      if (!(await serviceRequests.findById(id))) throw notFound();
      const assignment = await adminQueries.getRequestAssignment(id);
      if (!assignment) {
        throw new AdminServiceRequestError(
          "NOT_FOUND",
          "Request assignment not found.",
          404
        );
      }
      return toAssignmentResponse(assignment);
    });
  }

  listQuotes(
    identity: VerifiedSupabaseIdentity,
    requestId: string,
    input: unknown
  ): Promise<AdminPageResponse<AdminRequestQuoteResponse>> {
    const id = parseUuid(requestId);
    const pagination = parsePagination(input);
    return this.unitOfWork.execute(async ({
      adminQueries,
      serviceRequests,
      users
    }) => {
      await loadActiveAdminActor(identity, users);
      if (!(await serviceRequests.findById(id))) throw notFound();
      const result = await adminQueries.listRequestQuotes({
        requestId: id,
        limit: pagination.limit,
        ...(pagination.cursor ? { cursor: pagination.cursor } : {})
      });
      return toPage(
        result.items.map(toQuoteResponse),
        pagination.limit,
        result.nextCursor
      );
    });
  }

  cancel(
    identity: VerifiedSupabaseIdentity,
    requestId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminServiceRequestDetailResponse> {
    return this.changeRequestState(
      identity,
      requestId,
      input,
      idempotencyKey,
      "cancel"
    );
  }

  manualEscalate(
    identity: VerifiedSupabaseIdentity,
    requestId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminServiceRequestDetailResponse> {
    return this.changeRequestState(
      identity,
      requestId,
      input,
      idempotencyKey,
      "manual_escalate"
    );
  }

  repairCancellation(identity: VerifiedSupabaseIdentity, requestId: string, input: unknown, idempotencyKey: string): Promise<CancellationRepairResponse> {
    const id = parseUuid(requestId);
    const parsed = cancellationRepairInput.safeParse(input);
    if (!parsed.success) throw invalid("Assignment ID, reason and optional dry_run are required.");
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const request = await repositories.serviceRequests.findByIdForUpdate(id);
      if (!request) throw notFound();
      const scope = "admin.service_request.repair_cancellation";
      const now = this.now();
      if (!parsed.data.dry_run) {
        const replay = await this.prepareCommand(repositories, actor.id, scope, idempotencyKey, { request_id: id, ...parsed.data }, now);
        if (replay) return replay as CancellationRepairResponse;
      }
      const assignment = await repositories.assignments.findByIdForUpdate(parsed.data.assignment_id);
      const history = assignment ? await repositories.assignments.findCancellationHistory(assignment.id) : undefined;
      const expectedRequestState = history?.fromStatus === "accepted" ? "assigned" : history?.fromStatus === "en_route" ? "mechanic_en_route" :
        ["on_site", "diagnosis"].includes(history?.fromStatus ?? "") ? "in_service" : undefined;
      let reason: string | undefined;
      if (!assignment || assignment.requestId !== id || assignment.status !== "canceled" || !assignment.canceledAt ||
        !history || history.createdAt.getTime() !== assignment.canceledAt.getTime() || request.status !== expectedRequestState) reason = "history_insufficient";
      else if (await repositories.assignments.findActiveByRequestForUpdate(id)) reason = "replacement_active";
      else if (await repositories.payments.hasUnresolvedForRequest({ requestId: id })) reason = "payment_unresolved";
      else if (assignment.rescueLaborQuoteId || assignment.maintenanceLaborQuoteId) reason = "agreement_exists";
      else if (await repositories.quotes.hasAnyByAssignment(assignment.id)) reason = "quote_already_issued";
      const preview: CancellationRepairResponse = { request_id: id, assignment_id: parsed.data.assignment_id, dry_run: parsed.data.dry_run,
        repairable: !reason, ...(reason ? { reason_code: reason } : {}), status: request.status };
      if (parsed.data.dry_run) return preview;
      if (reason) throw new CancellationConflict(reason);
      assertRequestStatusTransition(request.status, "canceled");
      await reconcileOpenDispatchForRequest(repositories.dispatch, id, now);
      const updated = await repositories.serviceRequests.updateStatus({ id, status: "canceled", canceledReason: parsed.data.reason, updatedAt: now });
      if (!updated) throw notFound();
      await repositories.serviceRequests.appendStatusHistory({ id: this.createId(), requestId: id, fromStatus: request.status,
        toStatus: "canceled", actorId: actor.id, reason: parsed.data.reason, createdAt: now });
      await this.recordMutation(repositories, { actorId: actor.id, action: "admin.service_request.cancellation_repaired", requestId: id,
        reason: parsed.data.reason, metadata: { request_id: id, assignment_id: parsed.data.assignment_id, previous_status: request.status, next_status: "canceled" }, now });
      const response = { ...preview, status: "canceled" as const };
      await completeCommand(repositories, actor.id, scope, idempotencyKey, response, id, now, 200);
      return response;
    });
  }

  repairReservation(identity: VerifiedSupabaseIdentity, requestId: string, input: unknown, idempotencyKey: string): Promise<ReservationRepairResponse> {
    const id = parseUuid(requestId);
    const parsed = reservationRepairInput.safeParse(input);
    if (!parsed.success) throw invalid("Assignment ID, reason and confirmed estimated_duration_minutes (15–480) are required.");
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const request = await repositories.serviceRequests.findByIdForUpdate(id);
      if (!request) throw notFound();
      const now = this.now();
      const scope = "admin.service_request.repair_reservation";
      if (!parsed.data.dry_run) {
        const replay = await this.prepareCommand(repositories, actor.id, scope, idempotencyKey, { request_id: id, ...parsed.data }, now);
        if (replay) return replay as ReservationRepairResponse;
      }
      const snapshot = await repositories.assignments.findById(parsed.data.assignment_id);
      const profile = snapshot ? await repositories.mechanics.findProfileByUserIdForUpdate(snapshot.mechanicId) : undefined;
      const assignment = snapshot ? await repositories.assignments.findByIdForUpdate(snapshot.id) : undefined;
      const mechanic = assignment ? await repositories.users.findActorById(assignment.mechanicId) : undefined;
      const start = request.scheduledStartAt ? new Date(request.scheduledStartAt.getTime() - 30 * 60_000) : undefined;
      const end = request.scheduledStartAt ? new Date(request.scheduledStartAt.getTime() + (parsed.data.estimated_duration_minutes + 30) * 60_000) : undefined;
      let reason: string | undefined;
      if (!assignment || assignment.requestId !== id || request.status !== "assigned" || assignment.status !== "accepted" ||
        !["at_home_service", "other"].includes(request.serviceType) || !start || !end || !request.scheduledStartAt ||
        request.scheduledStartAt <= now || assignment.scheduledStartAt) reason = "not_legacy_future_booking";
      else if (assignment.startedAt || assignment.activatedAt || await repositories.assignments.hasTravelHistory(assignment.id)) reason = "travel_already_started";
      else if (!request.serviceLocation) reason = "location_required";
      else if (!profile || profile.profileStatus !== "active" || mechanic?.status !== "active" ||
        !mechanic.roles.includes("mechanic")) reason = "mechanic_ineligible";
      else if (await repositories.payments.hasUnresolvedForRequest({ requestId: id })) reason = "payment_unresolved";
      else if (assignment.rescueLaborQuoteId || assignment.maintenanceLaborQuoteId) reason = "agreement_exists";
      else if (await repositories.quotes.hasAnyByAssignment(assignment.id)) reason = "quote_already_issued";
      else if (await repositories.assignments.findReservationConflict({ mechanicId: assignment.mechanicId, start, end, excludeId: assignment.id })) reason = "reservation_overlap";
      const response: ReservationRepairResponse = { request_id: id, assignment_id: parsed.data.assignment_id,
        dry_run: parsed.data.dry_run, repairable: !reason, ...(reason ? { reason_code: reason } : {}),
        scheduled_start_at: request.scheduledStartAt?.toISOString(), reservation_start_at: start?.toISOString(), reservation_end_at: end?.toISOString() };
      if (parsed.data.dry_run) return response;
      if (reason || !assignment || !start || !end || !request.scheduledStartAt) throw new CancellationConflict(reason ?? "not_legacy_future_booking");
      await repositories.assignments.setReservation({ id: assignment.id, scheduledStartAt: request.scheduledStartAt, start, end, updatedAt: now });
      await this.recordMutation(repositories, { actorId: actor.id, action: "admin.service_request.reservation_repaired", requestId: id,
        reason: parsed.data.reason, metadata: { request_id: id, assignment_id: assignment.id, estimated_duration_minutes: parsed.data.estimated_duration_minutes }, now });
      await completeCommand(repositories, actor.id, scope, idempotencyKey, response, id, now, 200);
      return response;
    });
  }

  addNote(
    identity: VerifiedSupabaseIdentity,
    requestId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AdminRequestNoteResponse> {
    const id = parseUuid(requestId);
    const parsed = adminInternalNoteMutationSchema.safeParse(input);
    if (!parsed.success) {
      throw invalid("A valid administrative reason and note are required.");
    }
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.now();
      const scope = "admin.service_request.note.add";
      const replay = await this.prepareCommand(
        repositories,
        actor.id,
        scope,
        idempotencyKey,
        { request_id: id, reason: parsed.data.reason, note: parsed.data.note },
        now
      );
      if (replay) return replay as AdminRequestNoteResponse;
      if (!(await repositories.serviceRequests.findByIdForUpdate(id))) {
        throw notFound();
      }
      const note = await repositories.adminInternalNotes.create({
        id: this.createId(),
        adminId: actor.id,
        serviceRequestId: id,
        noteText: parsed.data.note,
        createdAt: now
      });
      const response: AdminRequestNoteResponse = {
        id: note.id,
        request_id: id,
        admin_id: actor.id,
        note: note.noteText,
        created_at: note.createdAt.toISOString()
      };
      await this.recordMutation(repositories, {
        actorId: actor.id,
        action: "admin.service_request.note_added",
        requestId: id,
        reason: parsed.data.reason,
        metadata: {
          resource_id: id,
          entity_id: note.id,
          request_id: id,
          status: "created"
        },
        now
      });
      await completeCommand(
        repositories,
        actor.id,
        scope,
        idempotencyKey,
        response,
        id,
        now,
        201
      );
      return response;
    });
  }

  private changeRequestState(
    identity: VerifiedSupabaseIdentity,
    requestId: string,
    input: unknown,
    idempotencyKey: string,
    command: AdminRequestCommand
  ): Promise<AdminServiceRequestDetailResponse> {
    const id = parseUuid(requestId);
    const parsed = adminReasonSchema.safeParse(input);
    if (!parsed.success) {
      throw invalid("A valid administrative reason is required.");
    }
    const nextStatus =
      command === "cancel" ? ("canceled" as const) : ("manual_escalation" as const);
    const scope = `admin.service_request.${command}`;
    const action =
      command === "cancel"
        ? "admin.service_request.canceled"
        : "admin.service_request.manual_escalated";

    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const now = this.now();
      const replay = await this.prepareCommand(
        repositories,
        actor.id,
        scope,
        idempotencyKey,
        { request_id: id, reason: parsed.data.reason },
        now
      );
      if (replay) return replay as AdminServiceRequestDetailResponse;

      const request = await repositories.serviceRequests.findByIdForUpdate(id);
      if (!request) throw notFound();
      if (!canRunAdminRequestCommand(request.status, command)) {
        throw conflict(
          `Service request cannot run ${command} from ${request.status}.`
        );
      }
      const assignment = await repositories.assignments.findActiveByRequestForUpdate(id);
      if (command === "cancel") {
        if (await repositories.payments.hasUnresolvedForRequest({ requestId: id })) throw new CancellationConflict("payment_unresolved");
        if (!assignment && await repositories.quotes.hasOpenByRequest(id)) throw new CancellationConflict("quote_commitment");
        if (!assignment && ["assigned", "mechanic_en_route", "in_service"].includes(request.status)) throw new CancellationConflict("assignment_missing");
        if (assignment) await cancelUncommittedAssignment(repositories, assignment, {
          actorId: actor.id, actorRole: "admin", reason: parsed.data.reason, now, createId: () => this.createId(), allowClosedQuotes: true
        });
        assertRequestStatusTransition(request.status, "canceled");
      } else if (assignment) {
        throw conflict(
          "An active assignment must be resolved through the assignment workflow."
        );
      }

      const reconciliation = await reconcileOpenDispatchForRequest(
        repositories.dispatch,
        id,
        now
      );
      const updated = await repositories.serviceRequests.updateStatus({
        id,
        status: nextStatus,
        updatedAt: now,
        ...(nextStatus === "canceled"
          ? { canceledReason: parsed.data.reason }
          : { manualEscalationReason: parsed.data.reason })
      });
      if (!updated) throw notFound();
      await repositories.serviceRequests.appendStatusHistory({
        id: this.createId(),
        requestId: id,
        fromStatus: request.status,
        toStatus: nextStatus,
        actorId: actor.id,
        reason: parsed.data.reason,
        createdAt: now
      });
      await this.recordMutation(repositories, {
        actorId: actor.id,
        action,
        requestId: id,
        reason: parsed.data.reason,
        metadata: {
          resource_id: id,
          request_id: id,
          previous_status: request.status,
          next_status: nextStatus,
          changes: {
            status: nextStatus,
            canceled_rounds: reconciliation.canceledRounds,
            canceled_candidates: reconciliation.canceledCandidates
          }
        },
        now
      });
      const detail = await repositories.adminQueries.getServiceRequestDetail(id);
      if (!detail) throw notFound();
      const response = toRequestDetailResponse(detail);
      await completeCommand(
        repositories,
        actor.id,
        scope,
        idempotencyKey,
        response,
        id,
        now,
        200
      );
      return response;
    });
  }

  private async prepareCommand(
    repositories: FoundationRepositories,
    actorId: string,
    scope: string,
    idempotencyKey: string,
    request: unknown,
    now: Date
  ): Promise<Record<string, unknown> | undefined> {
    const decision = await prepareIdempotency(repositories.idempotency, {
      actorId,
      scope,
      idempotencyKey,
      request,
      expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
      id: this.createId()
    });
    if (decision.action === "conflict") {
      throw conflict("Idempotency key was already used with different input.");
    }
    if (decision.action === "in_progress") {
      throw conflict("An operation with this idempotency key is in progress.");
    }
    return decision.action === "replay" ? decision.responseBody : undefined;
  }

  private async recordMutation(
    repositories: FoundationRepositories,
    input: {
      actorId: string;
      action: string;
      requestId: string;
      reason: string;
      metadata: Record<string, unknown>;
      now: Date;
    }
  ) {
    const occurrenceId = this.createId();
    await repositories.outbox.append({
      id: occurrenceId,
      topic: input.action,
      aggregateType: "service_request",
      aggregateId: input.requestId,
      dedupeKey: `${input.action}:${input.requestId}:${occurrenceId}`,
      payload: input.metadata,
      createdAt: input.now,
      nextAttemptAt: input.now
    });
    await repositories.audit.append({
      id: this.createId(),
      actorId: input.actorId,
      actorRole: "admin",
      action: input.action,
      entityType: "service_request",
      entityId: input.requestId,
      requestId: input.requestId,
      adminReason: input.reason,
      metadata: input.metadata,
      createdAt: input.now
    });
  }

  private now() {
    return this.options.now?.() ?? new Date();
  }

  private createId() {
    return (this.options.createId ?? randomUUID)();
  }
}

export class AdminServiceRequestError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT"
    >,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AdminServiceRequestError";
  }
}

function parseListFilters(input: unknown) {
  const parsed = adminServiceRequestListFilterSchema.safeParse(input);
  if (!parsed.success) throw invalid("Service-request list filters are invalid.");
  return {
    limit: parsed.data.limit,
    ...(parsed.data.cursor ? { cursor: decodeCursor(parsed.data.cursor) } : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.service_type
      ? { serviceType: parsed.data.service_type }
      : {}),
    ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
    ...(parsed.data.rider_id ? { riderId: parsed.data.rider_id } : {}),
    ...(parsed.data.mechanic_id ? { mechanicId: parsed.data.mechanic_id } : {}),
    ...(parsed.data.request_code
      ? { requestCode: parsed.data.request_code }
      : {}),
    ...(parsed.data.from ? { from: new Date(parsed.data.from) } : {}),
    ...(parsed.data.to ? { to: new Date(parsed.data.to) } : {})
  };
}

function parsePagination(input: unknown) {
  const parsed = adminPaginationSchema.safeParse(input);
  if (!parsed.success) throw invalid("Pagination input is invalid.");
  return {
    limit: parsed.data.limit,
    ...(parsed.data.cursor ? { cursor: decodeCursor(parsed.data.cursor) } : {})
  };
}

function parseTimelinePagination(input: unknown) {
  const parsed = adminPaginationSchema.safeParse(input);
  if (!parsed.success) throw invalid("Pagination input is invalid.");
  return {
    limit: parsed.data.limit,
    ...(parsed.data.cursor
      ? { cursor: decodeTimelineCursor(parsed.data.cursor) }
      : {})
  };
}

function parseUuid(value: string) {
  const parsed = adminUuidSchema.safeParse(value);
  if (!parsed.success) throw invalid("Service-request identifier is invalid.");
  return parsed.data;
}

function encodeCursor(cursor: AdminRequestCursor) {
  return Buffer.from(
    JSON.stringify({ timestamp: cursor.timestamp.toISOString(), id: cursor.id })
  ).toString("base64url");
}

function decodeCursor(value: string): AdminRequestCursor {
  const parsed = decodeRawCursor(value);
  return { timestamp: parsed.timestamp, id: parsed.id };
}

function encodeTimelineCursor(cursor: AdminRequestTimelineCursor) {
  return Buffer.from(
    JSON.stringify({ timestamp: cursor.createdAt.toISOString(), id: cursor.id })
  ).toString("base64url");
}

function decodeTimelineCursor(value: string): AdminRequestTimelineCursor {
  const parsed = decodeRawCursor(value);
  return { createdAt: parsed.timestamp, id: parsed.id };
}

function decodeRawCursor(value: string): { timestamp: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      timestamp?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.timestamp !== "string" ||
      Number.isNaN(new Date(parsed.timestamp).getTime()) ||
      typeof parsed.id !== "string" ||
      !adminUuidSchema.safeParse(parsed.id).success
    ) {
      throw new Error("INVALID_CURSOR");
    }
    return { timestamp: new Date(parsed.timestamp), id: parsed.id };
  } catch {
    throw invalid("Cursor is invalid.");
  }
}

function toPage<T>(
  items: T[],
  limit: number,
  nextCursor?: AdminRequestCursor
): AdminPageResponse<T> {
  return {
    items,
    page: {
      limit,
      has_more: Boolean(nextCursor),
      ...(nextCursor ? { next_cursor: encodeCursor(nextCursor) } : {})
    }
  };
}

function toTimelinePage<T>(
  items: T[],
  limit: number,
  nextCursor?: AdminRequestTimelineCursor
): AdminPageResponse<T> {
  return {
    items,
    page: {
      limit,
      has_more: Boolean(nextCursor),
      ...(nextCursor
        ? { next_cursor: encodeTimelineCursor(nextCursor) }
        : {})
    }
  };
}

function toRequestSummaryResponse(
  request: AdminServiceRequestSummary
): AdminServiceRequestSummaryResponse {
  return {
    id: request.id,
    request_code: request.requestCode,
    rider_id: request.riderId,
    motorcycle_id: request.motorcycleId,
    service_type: request.serviceType,
    ...(request.fulfillmentMode
      ? { fulfillment_mode: request.fulfillmentMode }
      : {}),
    status: request.status,
    priority: request.priority,
    ...(request.mechanicId ? { mechanic_id: request.mechanicId } : {}),
    ...(request.scheduledStartAt
      ? { scheduled_start_at: request.scheduledStartAt.toISOString() }
      : {}),
    created_at: request.createdAt.toISOString(),
    updated_at: request.updatedAt.toISOString()
  };
}

function toRequestDetailResponse(
  request: AdminServiceRequestDetail
): AdminServiceRequestDetailResponse {
  return {
    ...toRequestSummaryResponse(request),
    ...(request.dispatch
      ? {
          dispatch: {
            round_id: request.dispatch.roundId,
            round_number: request.dispatch.roundNumber,
            status: request.dispatch.status,
            started_at: request.dispatch.startedAt.toISOString(),
            expires_at: request.dispatch.expiresAt.toISOString(),
            ...(request.dispatch.completedAt
              ? { completed_at: request.dispatch.completedAt.toISOString() }
              : {}),
            open_candidate_count: request.dispatch.openCandidateCount
          }
        }
      : {}),
    ...(request.assignment
      ? { assignment: toAssignmentResponse(request.assignment) }
      : {}),
    ...(request.latestQuote
      ? { latest_quote: toQuoteResponse(request.latestQuote) }
      : {}),
    ...(request.reminder
      ? {
          reminder: {
            reminder_id: request.reminder.reminderId,
            ...(request.reminder.occurrenceId
              ? { occurrence_id: request.reminder.occurrenceId }
              : {})
          }
        }
      : {})
  };
}

function toAssignmentResponse(
  assignment: AdminRequestAssignmentSummary
): AdminRequestAssignmentResponse {
  return {
    id: assignment.id,
    request_id: assignment.requestId,
    mechanic_id: assignment.mechanicId,
    status: assignment.status,
    accepted_at: assignment.acceptedAt.toISOString(),
    ...(assignment.startedAt
      ? { started_at: assignment.startedAt.toISOString() }
      : {}),
    ...(assignment.completedAt
      ? { completed_at: assignment.completedAt.toISOString() }
      : {}),
    ...(assignment.canceledAt
      ? { canceled_at: assignment.canceledAt.toISOString() }
      : {}),
    created_at: assignment.createdAt.toISOString(),
    updated_at: assignment.updatedAt.toISOString()
  };
}

function toQuoteResponse(
  quote: AdminRequestQuoteSummary
): AdminRequestQuoteResponse {
  return {
    id: quote.id,
    request_id: quote.requestId,
    assignment_id: quote.assignmentId,
    version: quote.version,
    status: quote.status,
    currency: quote.currency,
    subtotal_amount: quote.subtotalAmount,
    discount_amount: quote.discountAmount,
    total_amount: quote.totalAmount,
    ...(quote.expiresAt ? { expires_at: quote.expiresAt.toISOString() } : {}),
    created_at: quote.createdAt.toISOString(),
    ...(quote.respondedAt
      ? { responded_at: quote.respondedAt.toISOString() }
      : {})
  };
}

function toTimelineResponse(
  item: AdminRequestTimelineItem
): AdminRequestTimelineResponse {
  if (item.kind === "internal_note") {
    return {
      id: item.id,
      kind: item.kind,
      admin_id: item.adminId,
      note: item.noteText,
      created_at: item.createdAt.toISOString()
    };
  }
  return {
    id: item.id,
    kind: item.kind,
    ...(item.fromStatus ? { from_status: item.fromStatus } : {}),
    to_status: item.toStatus,
    ...(item.actorId ? { actor_id: item.actorId } : {}),
    ...(item.reason ? { reason: sanitizeAdminReason(item.reason) } : {}),
    created_at: item.createdAt.toISOString()
  };
}

function toMediaResponse(
  media: AdminRequestMediaSummary
): AdminRequestMediaResponse {
  return {
    id: media.id,
    request_id: media.requestId,
    media_type: media.mediaType,
    content_type: media.contentType,
    ...(media.sizeBytes !== undefined ? { size_bytes: media.sizeBytes } : {}),
    created_by: media.createdBy,
    created_at: media.createdAt.toISOString()
  };
}

async function completeCommand(
  repositories: FoundationRepositories,
  actorId: string,
  scope: string,
  idempotencyKey: string,
  response: object,
  requestId: string,
  now: Date,
  responseStatus: number
) {
  await repositories.idempotency.complete({
    actorId,
    scope,
    idempotencyKey,
    responseStatus,
    responseBody: response as Record<string, unknown>,
    resourceType: "service_request",
    resourceId: requestId,
    completedAt: now
  });
}

function invalid(message: string) {
  return new AdminServiceRequestError("INVALID_INPUT", message, 400);
}

function notFound() {
  return new AdminServiceRequestError(
    "NOT_FOUND",
    "Service request not found.",
    404
  );
}

function conflict(message: string) {
  return new AdminServiceRequestError("CONFLICT", message, 409);
}
