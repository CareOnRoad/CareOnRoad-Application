import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import { prepareIdempotency } from "@/lib/idempotency";
import type { ServiceType } from "@/features/motorcycles/motorcycle.schemas";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { requireActorRole } from "@/features/auth/authorization";
import { persistNotification } from "@/features/notifications/notification.service";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import type { Motorcycle } from "@/server/repositories/contracts/motorcycle.repository";
import type {
  FulfillmentMode,
  RequestStatus,
  ServiceRequest
} from "@/server/repositories/contracts/service-request.repository";
import type { RequestMediaMetadata } from "@/server/repositories/contracts/request-media.repository";

import { RequestCodeService } from "./request-code.service";
import {
  cancelServiceRequestInputSchema,
  appointmentUpdateSchema,
  requestMediaMetadataInputSchema,
  serviceRequestInputSchema,
  type RequestMediaMetadataInput,
  type ServiceRequestInput
} from "./service-request.schemas";
import { assertRequestStatusTransition } from "./service-request-state";

const CREATE_SCOPE = "POST /api/v1/service-requests";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_RETRY_ATTEMPTS = 3;

export type ServiceRequestResponse = {
  id: string;
  request_code: string;
  rider_id: string;
  motorcycle_id: string;
  service_type: ServiceType;
  fulfillment_mode?: FulfillmentMode;
  problem_description: string;
  status: RequestStatus;
  priority: string;
  location?: { latitude: number; longitude: number };
  address_text?: string;
  scheduled_start_at?: string;
  safety_answers?: Record<string, unknown>;
  maintenance_notes?: string;
  reminder_id?: string;
  reminder_context_id?: string;
  canceled_reason?: string;
  media_metadata?: RequestMediaMetadataResponse[];
  created_at: string;
  updated_at: string;
};

export type RequestMediaMetadataResponse = {
  id: string;
  request_id: string;
  media_type: string;
  object_reference: string;
  content_type: string;
  size_bytes?: number;
  checksum?: string;
  created_by: string;
  created_at: string;
};

export class ServiceRequestService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  async createServiceRequest(
    identity: VerifiedSupabaseIdentity,
    input: unknown,
    idempotencyKey: string
  ): Promise<ServiceRequestResponse> {
    const parsed = this.parseCreateInput(input);

    for (let attempt = 1; attempt <= CODE_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await this.createServiceRequestOnce(identity, parsed, idempotencyKey);
      } catch (error) {
        if (attempt < CODE_RETRY_ATTEMPTS && isRequestCodeConflict(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ServiceRequestError("CONFLICT", "Could not allocate a request code.", 409);
  }

  listServiceRequests(identity: VerifiedSupabaseIdentity): Promise<{ items: ServiceRequestResponse[] }> {
    return this.unitOfWork.execute(async ({ serviceRequests, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const requests = await serviceRequests.listByRider(actor.id);
      return { items: requests.map((request) => toServiceRequestResponse(request)) };
    });
  }

  async updateAppointment(identity: VerifiedSupabaseIdentity, requestId: string, input: unknown, key: string) {
    if (!serviceRequestInputSchema.shape.motorcycle_id.safeParse(requestId).success) throw invalidMatrix("Request ID must be a UUID.");
    const parsed = appointmentUpdateSchema.safeParse(input);
    if (!parsed.success) throw invalidMatrix("Appointment update input is invalid.");
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadRiderActor(repositories.users, identity.subject);
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const scope = `PATCH /api/v1/service-requests/${requestId}`;
      const decision = await prepareIdempotency(repositories.idempotency, {
        actorId: actor.id, scope, idempotencyKey: key, request: parsed.data,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS), id: createId()
      });
      if (decision.action === "replay") return decision.responseBody as unknown as ServiceRequestResponse;
      if (decision.action !== "execute") throw new ServiceRequestError("CONFLICT", "Idempotency key is conflicting or in progress.", 409);
      const existing = await repositories.serviceRequests.findByIdForUpdate(requestId);
      if (!existing) throw new ServiceRequestError("NOT_FOUND", "Service request not found.", 404);
      if (existing.riderId !== actor.id) throw new ServiceRequestError("FORBIDDEN", "Request ownership is required.", 403);
      if (existing.serviceType !== "periodic_maintenance" || existing.status !== "submitted" ||
        (await repositories.dispatch.listRoundsByRequest(existing.id)).length ||
        await repositories.assignments.findActiveByRequestForUpdate(existing.id)) {
        throw new ServiceRequestError("CONFLICT", "Only maintenance requests before matching can be edited.", 409);
      }
      await loadOwnedMotorcycle(repositories.motorcycles, existing.motorcycleId, actor.id);
      const location = parsed.data.location ?? existing.serviceLocation;
      const start = parsed.data.scheduled_start_at === null ? undefined :
        parsed.data.scheduled_start_at ? new Date(parsed.data.scheduled_start_at) : existing.scheduledStartAt;
      if (!location || (start && start <= now) || (!start && !existing.reminderContextId)) {
        throw invalidMatrix("A location and a future appointment or reminder origin are required.");
      }
      const updated = await repositories.serviceRequests.updateAppointment({
        id: existing.id, location, addressText: parsed.data.address_text ?? existing.addressText,
        scheduledStartAt: start, updatedAt: now
      });
      await appendRequestMutationAuditOutbox({ action: "service_request.appointment_updated", request: updated,
        actorId: actor.id, audit: repositories.audit, outbox: repositories.outbox, now, createId });
      const eventId = createId();
      await repositories.outbox.append({ id: eventId, topic: "maintenance.dispatch.requested", aggregateType: "service_request",
        aggregateId: existing.id, dedupeKey: `maintenance.dispatch.requested:${existing.id}:${eventId}`,
        payload: { request_id: existing.id }, createdAt: now, nextAttemptAt: now });
      const response = toServiceRequestResponse(updated);
      await repositories.idempotency.complete({ actorId: actor.id, scope, idempotencyKey: key,
        responseStatus: 200, responseBody: response as unknown as Record<string, unknown>,
        resourceType: "service_request", resourceId: existing.id, completedAt: now });
      return response;
    });
  }

  getServiceRequest(
    identity: VerifiedSupabaseIdentity,
    requestId: string
  ): Promise<ServiceRequestResponse> {
    return this.unitOfWork.execute(async ({ serviceRequests, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const request = await loadOwnedRequest(serviceRequests, requestId, actor.id);
      return toServiceRequestResponse(request);
    });
  }

  cancelServiceRequest(
    identity: VerifiedSupabaseIdentity,
    requestId: string,
    input: unknown
  ): Promise<ServiceRequestResponse> {
    const parsed = cancelServiceRequestInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceRequestError("INVALID_INPUT", "Cancellation input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }

    return this.unitOfWork.execute(async (repositories) => {
      const {
        assignments,
        audit,
        dispatch,
        outbox,
        serviceRequests,
        users
      } = repositories;
      const actor = await loadRiderActor(users, identity.subject);
      const existing = await serviceRequests.findByIdForUpdate(requestId);
      if (!existing) {
        throw new ServiceRequestError("NOT_FOUND", "Service request not found.", 404);
      }
      if (existing.riderId !== actor.id) {
        throw new ServiceRequestError("FORBIDDEN", "Service request ownership is required.", 403);
      }
      if (!["submitted", "dispatching", "offered"].includes(existing.status)) {
        throw new ServiceRequestError("CONFLICT", "Service request cannot be canceled in its current state.", 409);
      }
      if (await assignments.findActiveByRequestForUpdate(existing.id)) {
        throw new ServiceRequestError(
          "CONFLICT",
          "An active assignment must be resolved through the assignment workflow.",
          409
        );
      }
      assertRequestStatusTransition(existing.status, "canceled");

      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const offeredMechanics = existing.serviceType === "periodic_maintenance" ?
        [...new Set((await dispatch.listCandidatesByRequest(existing.id))
          .filter((candidate) => candidate.status === "offered").map((candidate) => candidate.mechanicId))] : [];
      const reconciliation = await dispatch.cancelOpenDispatchForRequest({
        requestId: existing.id,
        now
      });
      const updated = await serviceRequests.updateStatus({
        id: requestId,
        status: "canceled",
        updatedAt: now,
        canceledReason: parsed.data.reason
      });
      if (!updated) {
        throw new ServiceRequestError("NOT_FOUND", "Service request not found.", 404);
      }
      await serviceRequests.appendStatusHistory({
        id: createId(),
        requestId: updated.id,
        fromStatus: existing.status,
        toStatus: "canceled",
        actorId: actor.id,
        reason: parsed.data.reason,
        createdAt: now
      });
      await appendRequestMutationAuditOutbox({
        action: "service_request.canceled",
        request: updated,
        actorId: actor.id,
        audit,
        outbox,
        now,
        createId,
        extraPayload: {
          canceled_rounds: reconciliation.canceledRounds,
          canceled_candidates: reconciliation.canceledCandidates
        }
      });

      for (const mechanicId of offeredMechanics) await persistNotification(repositories, {
        userId: mechanicId, type: "maintenance.booking.canceled", title: "Khách đã hủy yêu cầu bảo dưỡng",
        body: "Yêu cầu này không còn nhận thợ. Kiểm tra danh sách lời mời để xem yêu cầu khác.",
        data: { request_id: updated.id }, dedupeKey: `maintenance.booking.canceled:${updated.id}:${mechanicId}`,
        requestId: updated.id
      }, now, createId);

      return toServiceRequestResponse(updated);
    });
  }

  addMediaMetadata(
    identity: VerifiedSupabaseIdentity,
    requestId: string,
    input: unknown
  ): Promise<RequestMediaMetadataResponse> {
    const parsed = requestMediaMetadataInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceRequestError("INVALID_INPUT", "Request media metadata is invalid.", 400, {
        issues: parsed.error.issues
      });
    }

    return this.unitOfWork.execute(async ({ audit, outbox, requestMedia, serviceRequests, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const request = await loadOwnedRequest(serviceRequests, requestId, actor.id);
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const media = await requestMedia.create({
        id: createId(),
        requestId: request.id,
        ...toMediaRepositoryInput(parsed.data),
        createdBy: actor.id,
        createdAt: now
      });
      await appendRequestMutationAuditOutbox({
        action: "service_request.media_added",
        request,
        actorId: actor.id,
        audit,
        outbox,
        now,
        createId,
        extraPayload: { media_id: media.id, media_type: media.mediaType }
      });
      return toRequestMediaResponse(media);
    });
  }

  private async createServiceRequestOnce(
    identity: VerifiedSupabaseIdentity,
    parsed: ServiceRequestInput,
    idempotencyKey: string
  ): Promise<ServiceRequestResponse> {
    return this.unitOfWork.execute(async (repositories) => {
      const { audit, idempotency, motorcycles, outbox, requestMedia, serviceRequests, users } =
        repositories;
      const actor = await loadRiderActor(users, identity.subject);
      const now = this.options.now?.() ?? new Date();
      const decision = await prepareIdempotency(idempotency, {
        actorId: actor.id,
        scope: CREATE_SCOPE,
        idempotencyKey,
        request: parsed,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        id: (this.options.createId ?? randomUUID)()
      });

      if (decision.action === "conflict") {
        throw new ServiceRequestError("CONFLICT", "Idempotency key payload mismatch.", 409);
      }
      if (decision.action === "in_progress") {
        throw new ServiceRequestError("CONFLICT", "Idempotency key is already in progress.", 409);
      }
      if (decision.action === "replay") {
        return decision.responseBody as ServiceRequestResponse;
      }

      validateServiceTypeMatrix(parsed, now);
      const motorcycle = await loadOwnedMotorcycle(motorcycles, parsed.motorcycle_id, actor.id);
      const reminderContext = await validateReminderOrigin(repositories.reminders, {
        actorId: actor.id,
        motorcycleId: motorcycle.id,
        input: parsed,
        now
      });
      const createId = this.options.createId ?? randomUUID;
      const requestCode = await new RequestCodeService(repositories.requestCodes).allocate(
        parsed.service_type,
        now
      );
      const request = await serviceRequests.create({
        id: createId(),
        requestCode,
        riderId: actor.id,
        motorcycleId: motorcycle.id,
        serviceType: parsed.service_type,
        fulfillmentMode: parsed.fulfillment_mode,
        problemDescription: parsed.problem_description,
        status: "submitted",
        priority: parsed.service_type === "emergency_rescue" ? "emergency" : "normal",
        serviceLocation: parsed.location,
        addressText: parsed.address_text,
        scheduledStartAt: parsed.scheduled_start_at
          ? new Date(parsed.scheduled_start_at)
          : undefined,
        safetyAnswers: parsed.safety_answers,
        maintenanceNotes: parsed.maintenance_notes,
        reminderId: reminderContext?.ruleId,
        reminderContextId: reminderContext?.occurrenceId,
        createdAt: now,
        updatedAt: now
      });
      if (reminderContext) {
        await repositories.reminders.updateOccurrenceStatus({
          id: reminderContext.occurrenceId,
          status: "dismissed",
          processedAt: now
        });
      }
      await serviceRequests.appendStatusHistory({
        id: createId(),
        requestId: request.id,
        toStatus: "submitted",
        actorId: actor.id,
        createdAt: now
      });

      const media = [];
      for (const mediaInput of parsed.media_metadata ?? []) {
        media.push(
          await requestMedia.create({
            id: createId(),
            requestId: request.id,
            ...toMediaRepositoryInput(mediaInput),
            createdBy: actor.id,
            createdAt: now
          })
        );
      }

      await appendRequestMutationAuditOutbox({
        action: "service_request.created",
        request,
        actorId: actor.id,
        audit,
        outbox,
        now,
        createId,
        extraPayload: { media_count: media.length }
      });

      if (request.serviceType === "periodic_maintenance") await outbox.append({
        id: createId(), topic: "maintenance.dispatch.requested", aggregateType: "service_request",
        aggregateId: request.id, dedupeKey: `maintenance.dispatch.requested:${request.id}`,
        payload: { request_id: request.id }, createdAt: now, nextAttemptAt: now
      });
      const response = toServiceRequestResponse(request, media);
      await idempotency.complete({
        actorId: actor.id,
        scope: CREATE_SCOPE,
        idempotencyKey,
        responseStatus: 201,
        responseBody: response as unknown as Record<string, unknown>,
        resourceType: "service_request",
        resourceId: request.id,
        completedAt: now
      });
      return response;
    });
  }

  private parseCreateInput(input: unknown): ServiceRequestInput {
    const parsed = serviceRequestInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceRequestError("INVALID_INPUT", "Service request input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }
    // Validate structure before allocating idempotency IDs; validate the current time after replay.
    validateServiceTypeMatrix(parsed.data, new Date(0));
    return parsed.data;
  }
}

export class ServiceRequestError extends Error {
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
    this.name = "ServiceRequestError";
  }
}

function validateServiceTypeMatrix(input: ServiceRequestInput, now: Date): void {
  if (input.service_type !== "other" && input.fulfillment_mode) {
    throw invalidMatrix("Fixed-mode service types do not accept fulfillment_mode.");
  }
  if ((input.reminder_id && !input.reminder_context_id) || (!input.reminder_id && input.reminder_context_id)) {
    throw invalidMatrix("Reminder-originated requests require reminder_id and reminder_context_id together.");
  }
  if ((input.reminder_id || input.reminder_context_id) && input.service_type !== "periodic_maintenance") {
    throw invalidMatrix("Reminder references are only valid for periodic maintenance.");
  }

  switch (input.service_type) {
    case "emergency_rescue":
      requireLocation(input);
      prohibitSchedule(input);
      return;
    case "mobile_repair":
      requireLocationOrAddress(input);
      prohibitSchedule(input);
      return;
    case "at_home_service":
      requireAddress(input);
      requireFutureSchedule(input, now);
      return;
    case "periodic_maintenance":
      requireLocation(input);
      if (!input.reminder_id && !input.reminder_context_id) {
        requireFutureSchedule(input, now);
      } else if (input.scheduled_start_at) {
        requireFutureSchedule(input, now);
      }
      return;
    case "other":
      validateOther(input, now);
      return;
  }
}

async function validateReminderOrigin(
  reminders: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["reminders"],
  input: {
    actorId: string;
    motorcycleId: string;
    input: ServiceRequestInput;
    now: Date;
  }
): Promise<{ ruleId: string; occurrenceId: string } | undefined> {
  if (!input.input.reminder_id || !input.input.reminder_context_id) {
    return undefined;
  }

  const rule = await reminders.findRuleByIdForUpdate(input.input.reminder_id);
  if (!rule) {
    throw new ServiceRequestError("NOT_FOUND", "Reminder rule not found.", 404);
  }
  if (rule.riderId !== input.actorId) {
    throw new ServiceRequestError("FORBIDDEN", "Reminder ownership is required.", 403);
  }
  if (rule.motorcycleId !== input.motorcycleId) {
    throw new ServiceRequestError("CONFLICT", "Reminder rule is not tied to the selected motorcycle.", 409);
  }

  const occurrence = await reminders.findOccurrenceByIdForUpdate(input.input.reminder_context_id);
  if (!occurrence) {
    throw new ServiceRequestError("NOT_FOUND", "Reminder occurrence not found.", 404);
  }
  if (occurrence.riderId !== input.actorId) {
    throw new ServiceRequestError("FORBIDDEN", "Reminder occurrence ownership is required.", 403);
  }
  if (occurrence.ruleId !== rule.id || occurrence.motorcycleId !== input.motorcycleId) {
    throw new ServiceRequestError(
      "CONFLICT",
      "Reminder occurrence is not tied to the selected motorcycle.",
      409
    );
  }
  if (occurrence.dueAt.getTime() > input.now.getTime() || !["due", "queued", "sent"].includes(occurrence.status)) {
    throw new ServiceRequestError("CONFLICT", "Reminder occurrence is not due.", 409);
  }

  return { ruleId: rule.id, occurrenceId: occurrence.id };
}

function validateOther(input: ServiceRequestInput, now: Date): void {
  if (!input.fulfillment_mode) {
    throw invalidMatrix("Other service requests require fulfillment_mode.");
  }
  if (input.fulfillment_mode === "immediate_location") {
    requireLocationOrAddress(input);
    prohibitSchedule(input);
    return;
  }
  requireAddress(input);
  requireFutureSchedule(input, now);
}

function requireLocation(input: ServiceRequestInput): void {
  if (!input.location) {
    throw invalidMatrix("A pickup location is required for this service type.");
  }
}

function requireLocationOrAddress(input: ServiceRequestInput): void {
  if (!input.location && !input.address_text) {
    throw invalidMatrix("A pickup location or service address is required for this service type.");
  }
}

function requireAddress(input: ServiceRequestInput): void {
  if (!input.address_text) {
    throw invalidMatrix("A service address is required for this service type.");
  }
}

function prohibitSchedule(input: ServiceRequestInput): void {
  if (input.scheduled_start_at) {
    throw invalidMatrix("scheduled_start_at is not allowed for this service type.");
  }
}

function requireFutureSchedule(input: ServiceRequestInput, now: Date): void {
  if (!input.scheduled_start_at || new Date(input.scheduled_start_at).getTime() <= now.getTime()) {
    throw invalidMatrix("A future scheduled_start_at is required for this service type.");
  }
}

function invalidMatrix(message: string): ServiceRequestError {
  return new ServiceRequestError("INVALID_INPUT", message, 400);
}

async function loadRiderActor(
  users: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["users"],
  actorId: string
) {
  const actor = await users.findActorById(actorId);
  if (!actor) {
    throw new ServiceRequestError("NOT_FOUND", "Application profile not found.", 404);
  }
  requireActorRole(
    {
      id: actor.id,
      ...(actor.displayName ? { display_name: actor.displayName } : {}),
      roles: actor.roles,
      status: actor.status
    },
    "rider"
  );
  return actor;
}

async function loadOwnedMotorcycle(
  motorcycles: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["motorcycles"],
  motorcycleId: string,
  riderId: string
): Promise<Motorcycle> {
  const motorcycle = await motorcycles.findById(motorcycleId);
  if (!motorcycle || motorcycle.archivedAt) {
    throw new ServiceRequestError("NOT_FOUND", "Motorcycle not found.", 404);
  }
  if (motorcycle.riderId !== riderId) {
    throw new ServiceRequestError("FORBIDDEN", "Motorcycle ownership is required.", 403);
  }
  return motorcycle;
}

async function loadOwnedRequest(
  serviceRequests: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["serviceRequests"],
  requestId: string,
  riderId: string
): Promise<ServiceRequest> {
  const request = await serviceRequests.findById(requestId);
  if (!request) {
    throw new ServiceRequestError("NOT_FOUND", "Service request not found.", 404);
  }
  if (request.riderId !== riderId) {
    throw new ServiceRequestError("FORBIDDEN", "Service request ownership is required.", 403);
  }
  return request;
}

async function appendRequestMutationAuditOutbox(input: {
  action: string;
  request: ServiceRequest;
  actorId: string;
  audit: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["audit"];
  outbox: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["outbox"];
  now: Date;
  createId: () => string;
  extraPayload?: Record<string, unknown>;
}): Promise<void> {
  const occurrenceId = input.createId();
  const payload = {
    resource_id: input.request.id,
    rider_id: input.request.riderId,
    service_type: input.request.serviceType,
    status: input.request.status,
    ...input.extraPayload
  };
  await input.outbox.append({
    id: occurrenceId,
    topic: input.action,
    aggregateType: "service_request",
    aggregateId: input.request.id,
    dedupeKey: `${input.action}:${input.request.id}:${occurrenceId}`,
    payload,
    createdAt: input.now,
    nextAttemptAt: input.now
  });
  await input.audit.append({
    id: input.createId(),
    actorId: input.actorId,
    actorRole: "rider",
    action: input.action,
    entityType: "service_request",
    entityId: input.request.id,
    requestId: input.request.id,
    metadata: payload,
    createdAt: input.now
  });
}

function toMediaRepositoryInput(input: RequestMediaMetadataInput) {
  return {
    mediaType: input.media_type,
    objectReference: input.object_reference,
    contentType: input.content_type,
    sizeBytes: input.size_bytes,
    checksum: input.checksum
  };
}

export function toServiceRequestResponse(
  request: ServiceRequest,
  media: RequestMediaMetadata[] = []
): ServiceRequestResponse {
  return {
    id: request.id,
    request_code: request.requestCode,
    rider_id: request.riderId,
    motorcycle_id: request.motorcycleId,
    service_type: request.serviceType,
    ...(request.fulfillmentMode ? { fulfillment_mode: request.fulfillmentMode } : {}),
    problem_description: request.problemDescription,
    status: request.status,
    priority: request.priority,
    ...(request.serviceLocation ? { location: request.serviceLocation } : {}),
    ...(request.addressText ? { address_text: request.addressText } : {}),
    ...(request.scheduledStartAt
      ? { scheduled_start_at: request.scheduledStartAt.toISOString() }
      : {}),
    ...(request.safetyAnswers ? { safety_answers: request.safetyAnswers } : {}),
    ...(request.maintenanceNotes ? { maintenance_notes: request.maintenanceNotes } : {}),
    ...(request.reminderId ? { reminder_id: request.reminderId } : {}),
    ...(request.reminderContextId ? { reminder_context_id: request.reminderContextId } : {}),
    ...(request.canceledReason ? { canceled_reason: request.canceledReason } : {}),
    ...(media.length ? { media_metadata: media.map(toRequestMediaResponse) } : {}),
    created_at: request.createdAt.toISOString(),
    updated_at: request.updatedAt.toISOString()
  };
}

export function toRequestMediaResponse(media: RequestMediaMetadata): RequestMediaMetadataResponse {
  return {
    id: media.id,
    request_id: media.requestId,
    media_type: media.mediaType,
    object_reference: media.objectReference,
    content_type: media.contentType,
    ...(media.sizeBytes !== undefined ? { size_bytes: media.sizeBytes } : {}),
    ...(media.checksum ? { checksum: media.checksum } : {}),
    created_by: media.createdBy,
    created_at: media.createdAt.toISOString()
  };
}

function isRequestCodeConflict(error: unknown): boolean {
  return error instanceof Error && error.message === "SERVICE_REQUEST_CODE_EXISTS";
}
