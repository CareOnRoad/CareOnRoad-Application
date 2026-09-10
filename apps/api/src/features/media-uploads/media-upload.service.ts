import { randomUUID } from "node:crypto";

import { requireActorRole } from "@/features/auth/authorization";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { prepareIdempotency } from "@/lib/idempotency";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/server/repositories/contracts/assignment.repository";
import type { MediaUploadIntent } from "@/server/repositories/contracts/media-upload-intent.repository";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { MediaUploadError } from "./media-upload.errors";
import {
  MEDIA_INTENT_TTL_MS,
  MEDIA_MAX_BYTES,
  MEDIA_MAX_FILES_PER_RESOURCE,
  assignmentMediaPurposes,
  createMediaObjectKey,
  createMediaUploadIntentSchema,
  mediaUploadIntentIdSchema,
  type CreateMediaUploadIntentInput
} from "./media-upload.schemas";
import type { MediaStorageProvider } from "./media-storage.provider";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type MediaUploadIntentResponse = {
  intent_id: string;
  resource_type: "service_request" | "assignment";
  resource_id: string;
  object_key: string;
  upload_url: string;
  upload_method: "PUT";
  required_headers: Record<string, string>;
  expires_at: string;
};

export type FinalizedMediaResponse = {
  intent_id: string;
  status: "finalized";
  resource_type: "service_request" | "assignment";
  resource_id: string;
  media: {
    id: string;
    purpose: string;
    content_type: string;
    size_bytes: number;
    created_at: string;
  };
};

export class MediaUploadService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly storage: MediaStorageProvider,
    private readonly bucket: string,
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  async createIntent(
    identity: VerifiedSupabaseIdentity,
    input: unknown,
    idempotencyKey: string
  ): Promise<MediaUploadIntentResponse> {
    validateIdempotencyKey(idempotencyKey);
    const parsed = createMediaUploadIntentSchema.safeParse(input);
    if (!parsed.success) {
      throw new MediaUploadError("INVALID_INPUT", "Media upload intent input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }
    const now = this.now();
    const intent = await this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActor(repositories, identity.subject);
      const resource = await authorizeResource(repositories, actor, parsed.data);
      const decision = await prepareIdempotency(repositories.idempotency, {
        actorId: actor.id,
        scope: "POST /api/v1/media/upload-intents",
        idempotencyKey: idempotencyKey.trim(),
        request: parsed.data,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        id: this.createId()()
      });
      if (decision.action === "conflict") throw conflict("Idempotency key payload mismatch.");
      if (decision.action === "in_progress") throw conflict("Idempotency key is already in progress.");
      if (decision.action === "replay") {
        const intentId = decision.responseBody.intent_id;
        if (typeof intentId !== "string") throw conflict("Stored upload intent is unavailable.");
        const replay = await repositories.mediaUploadIntents.findById(intentId);
        if (!replay || replay.actorId !== actor.id) throw conflict("Stored upload intent is unavailable.");
        return replay;
      }

      const pendingCount = await repositories.mediaUploadIntents.countForResource({
        resourceType: parsed.data.resource_type,
        requestId: resource.requestId,
        ...(resource.assignmentId ? { assignmentId: resource.assignmentId } : {}),
        now
      });
      const finalizedCount =
        parsed.data.resource_type === "service_request"
          ? (await repositories.requestMedia.listByRequest(resource.requestId)).length
          : (await repositories.mechanicOperations.listAssignmentMediaMetadata(resource.assignmentId!)).length;
      if (pendingCount + finalizedCount >= MEDIA_MAX_FILES_PER_RESOURCE) {
        throw conflict("Media limit reached for this resource.");
      }

      const intentId = this.createId()();
      const intent = await repositories.mediaUploadIntents.create({
        id: intentId,
        actorId: actor.id,
        actorRole: parsed.data.resource_type === "service_request" ? "rider" : "mechanic",
        resourceType: parsed.data.resource_type,
        requestId: resource.requestId,
        ...(resource.assignmentId ? { assignmentId: resource.assignmentId } : {}),
        purpose: parsed.data.purpose,
        storageBucket: this.bucket,
        objectKey: createMediaObjectKey({
          resourceType: parsed.data.resource_type,
          resourceId: parsed.data.resource_id,
          actorId: actor.id,
          intentId,
          contentType: parsed.data.content_type
        }),
        contentType: parsed.data.content_type,
        sizeBytes: parsed.data.size_bytes,
        sha256: parsed.data.sha256,
        expiresAt: new Date(now.getTime() + MEDIA_INTENT_TTL_MS),
        createdAt: now,
        updatedAt: now
      });
      await repositories.idempotency.complete({
        actorId: actor.id,
        scope: "POST /api/v1/media/upload-intents",
        idempotencyKey: idempotencyKey.trim(),
        responseStatus: 201,
        responseBody: { intent_id: intent.id },
        resourceType: "media_upload_intent",
        resourceId: intent.id,
        completedAt: now
      });
      return intent;
    });

    if (intent.status !== "pending" || intent.expiresAt <= this.now()) {
      throw conflict("Media upload intent is no longer active.");
    }
    const signed = await this.storage.createSignedUpload({
      bucket: intent.storageBucket,
      objectKey: intent.objectKey,
      contentType: intent.contentType
    });
    return {
      intent_id: intent.id,
      resource_type: intent.resourceType,
      resource_id: intent.assignmentId ?? intent.requestId,
      object_key: intent.objectKey,
      upload_url: signed.uploadUrl,
      upload_method: signed.method,
      required_headers: signed.requiredHeaders,
      expires_at: intent.expiresAt.toISOString()
    };
  }

  async finalizeIntent(
    identity: VerifiedSupabaseIdentity,
    intentId: string,
    idempotencyKey: string
  ): Promise<FinalizedMediaResponse> {
    validateIdempotencyKey(idempotencyKey);
    if (!mediaUploadIntentIdSchema.safeParse(intentId).success) {
      throw new MediaUploadError("INVALID_INPUT", "Upload intent id must be a valid UUID.", 400);
    }
    const now = this.now();
    const intent = await this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActor(repositories, identity.subject);
      const found = await repositories.mediaUploadIntents.findById(intentId);
      if (!found || found.actorId !== identity.subject) throw notFound();
      requireActorRole(toAuthActor(actor), found.actorRole);
      return found;
    });
    if (intent.status === "finalized") return storedFinalResponse(intent);
    if (intent.status !== "pending" || intent.expiresAt <= now) {
      throw conflict("Media upload intent is no longer active.");
    }

    const inspected = await this.storage.inspectAndHash({
      bucket: intent.storageBucket,
      objectKey: intent.objectKey,
      maxBytes: MEDIA_MAX_BYTES
    });
    if (!inspected) throw conflict("Uploaded media object was not found.");
    if (
      inspected.contentType !== intent.contentType ||
      inspected.sizeBytes !== intent.sizeBytes ||
      inspected.sha256 !== intent.sha256
    ) {
      await this.storage.remove({ bucket: intent.storageBucket, objectKey: intent.objectKey });
      throw conflict("Uploaded media does not match the upload intent.");
    }

    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActor(repositories, identity.subject);
      const locked = await repositories.mediaUploadIntents.findByIdForUpdate(intentId);
      if (!locked || locked.actorId !== actor.id) throw notFound();
      requireActorRole(toAuthActor(actor), locked.actorRole);
      if (locked.status === "finalized") return storedFinalResponse(locked);
      if (locked.status !== "pending" || locked.expiresAt <= this.now()) {
        throw conflict("Media upload intent is no longer active.");
      }
      const decision = await prepareIdempotency(repositories.idempotency, {
        actorId: actor.id,
        scope: `POST /api/v1/media/upload-intents/${intentId}/finalize`,
        idempotencyKey: idempotencyKey.trim(),
        request: { intent_id: intentId },
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        id: this.createId()()
      });
      if (decision.action === "conflict") throw conflict("Idempotency key payload mismatch.");
      if (decision.action === "in_progress") throw conflict("Idempotency key is already in progress.");
      if (decision.action === "replay") return decision.responseBody as FinalizedMediaResponse;

      const mediaId = this.createId()();
      const objectReference = `storage://${locked.storageBucket}/${locked.objectKey}`;
      if (locked.resourceType === "service_request") {
        await repositories.requestMedia.create({
          id: mediaId,
          requestId: locked.requestId,
          mediaType: locked.purpose,
          objectReference,
          contentType: locked.contentType,
          sizeBytes: locked.sizeBytes,
          checksum: locked.sha256,
          createdBy: actor.id,
          createdAt: now
        });
      } else {
        await repositories.mechanicOperations.createAssignmentMediaMetadata({
          id: mediaId,
          assignmentId: locked.assignmentId!,
          requestId: locked.requestId,
          mechanicId: actor.id,
          purpose: locked.purpose as (typeof assignmentMediaPurposes)[number],
          mediaReference: objectReference,
          contentType: locked.contentType,
          sizeBytes: locked.sizeBytes,
          checksum: locked.sha256,
          createdBy: actor.id,
          createdAt: now
        });
      }
      const response: FinalizedMediaResponse = {
        intent_id: locked.id,
        status: "finalized",
        resource_type: locked.resourceType,
        resource_id: locked.assignmentId ?? locked.requestId,
        media: {
          id: mediaId,
          purpose: locked.purpose,
          content_type: locked.contentType,
          size_bytes: locked.sizeBytes,
          created_at: now.toISOString()
        }
      };
      await appendMediaAuditOutbox(repositories, locked, actor.id, mediaId, now, this.createId());
      const finalized = await repositories.mediaUploadIntents.markFinalized({
        id: locked.id,
        mediaMetadataId: mediaId,
        finalizedResponse: response as unknown as Record<string, unknown>,
        finalizedAt: now
      });
      if (!finalized) throw conflict("Media upload intent changed concurrently.");
      await repositories.idempotency.complete({
        actorId: actor.id,
        scope: `POST /api/v1/media/upload-intents/${intentId}/finalize`,
        idempotencyKey: idempotencyKey.trim(),
        responseStatus: 201,
        responseBody: response as unknown as Record<string, unknown>,
        resourceType: "media_upload_intent",
        resourceId: locked.id,
        completedAt: now
      });
      return response;
    });
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private createId(): () => string {
    return this.options.createId ?? randomUUID;
  }
}

async function loadActor(repositories: FoundationRepositories, actorId: string) {
  const actor = await repositories.users.findActorById(actorId);
  if (!actor) throw notFound("Application profile not found.");
  return actor;
}

async function authorizeResource(
  repositories: FoundationRepositories,
  actor: Awaited<ReturnType<typeof loadActor>>,
  input: CreateMediaUploadIntentInput
): Promise<{ requestId: string; assignmentId?: string }> {
  const authActor = toAuthActor(actor);
  if (input.resource_type === "service_request") {
    requireActorRole(authActor, "rider");
    const request = await repositories.serviceRequests.findByIdForUpdate(input.resource_id);
    if (!request || request.riderId !== actor.id) throw notFound();
    return { requestId: request.id };
  }
  requireActorRole(authActor, "mechanic");
  const assignment = await repositories.assignments.findByIdForUpdate(input.resource_id);
  if (!assignment || assignment.mechanicId !== actor.id) throw notFound();
  if (!ACTIVE_ASSIGNMENT_STATUSES.includes(assignment.status as (typeof ACTIVE_ASSIGNMENT_STATUSES)[number])) {
    throw conflict("Assignment media uploads require an active assignment.");
  }
  return { requestId: assignment.requestId, assignmentId: assignment.id };
}

function toAuthActor(actor: Awaited<ReturnType<typeof loadActor>>) {
  return {
    id: actor.id,
    ...(actor.displayName ? { display_name: actor.displayName } : {}),
    roles: actor.roles,
    status: actor.status
  };
}

async function appendMediaAuditOutbox(
  repositories: FoundationRepositories,
  intent: MediaUploadIntent,
  actorId: string,
  mediaId: string,
  now: Date,
  createId: () => string
): Promise<void> {
  const action = intent.resourceType === "service_request"
    ? "service_request.media_uploaded"
    : "assignment.media_uploaded";
  const aggregateId = intent.assignmentId ?? intent.requestId;
  const payload = {
    media_metadata_id: mediaId,
    request_id: intent.requestId,
    ...(intent.assignmentId ? { assignment_id: intent.assignmentId } : {}),
    purpose: intent.purpose,
    content_type: intent.contentType,
    size_bytes: intent.sizeBytes
  };
  const occurrenceId = createId();
  await repositories.outbox.append({
    id: occurrenceId,
    topic: action,
    aggregateType: intent.resourceType,
    aggregateId,
    dedupeKey: `${action}:${intent.id}`,
    payload,
    createdAt: now,
    nextAttemptAt: now
  });
  await repositories.audit.append({
    id: createId(),
    actorId,
    actorRole: intent.actorRole,
    action,
    entityType: intent.resourceType,
    entityId: aggregateId,
    requestId: intent.requestId,
    metadata: payload,
    createdAt: now
  });
}

function storedFinalResponse(intent: MediaUploadIntent): FinalizedMediaResponse {
  if (!intent.finalizedResponse) throw conflict("Finalized media response is unavailable.");
  return intent.finalizedResponse as FinalizedMediaResponse;
}

function validateIdempotencyKey(key: string): void {
  const normalized = key.trim();
  if (normalized.length < 8 || normalized.length > 200) {
    throw new MediaUploadError("INVALID_INPUT", "X-Idempotency-Key is required.", 400);
  }
}

function notFound(message = "Media upload resource not found."): MediaUploadError {
  return new MediaUploadError("NOT_FOUND", message, 404);
}

function conflict(message: string): MediaUploadError {
  return new MediaUploadError("CONFLICT", message, 409);
}
