import { randomUUID } from "node:crypto";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { appendAssignmentAuditOutbox, loadActiveActor } from "@/features/assignments/assignment.service";
import { prepareIdempotency } from "@/lib/idempotency";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/server/repositories/contracts/assignment.repository";
import type {
  AssignmentCompletionChecklist,
  AssignmentEtaMetadata,
  AssignmentMediaMetadata
} from "@/server/repositories/contracts/mechanic-operations.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import { loadActiveMechanicActor } from "./mechanic-operations.authorization";
import { MechanicOperationsError } from "./mechanic-operations.errors";
import {
  assignmentEtaInputSchema,
  assignmentCompletionChecklistInputSchema,
  assignmentIdParamSchema,
  assignmentMediaInputSchema,
  MECHANIC_ETA_MAX_OFFSET_MS,
  MECHANIC_ETA_MIN_OFFSET_MS,
  type AssignmentCompletionChecklistInput,
  type AssignmentEtaInput,
  type AssignmentMediaInput
} from "./mechanic-operations.schemas";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type AssignmentEtaMetadataResponse = {
  id: string;
  assignment_id: string;
  request_id: string;
  mechanic_id: string;
  eta_at?: string;
  delay_reason?: string;
  created_at: string;
};

export type AssignmentMediaMetadataResponse = {
  id: string;
  assignment_id: string;
  request_id: string;
  mechanic_id: string;
  purpose: AssignmentMediaInput["purpose"];
  media_reference: string;
  content_type: string;
  size_bytes: number;
  checksum?: string;
  created_at: string;
};

export type AssignmentCompletionChecklistResponse = {
  id: string;
  assignment_id: string;
  request_id: string;
  mechanic_id: string;
  revision: number;
  approved_quote_id?: string;
  work_summary: string;
  safety_checklist: AssignmentCompletionChecklistInput["safety_checklist"];
  notes?: string;
  created_at: string;
};

export class MechanicAssignmentMetadataService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  async getCompletionChecklist(identity: VerifiedSupabaseIdentity, assignmentId: string): Promise<AssignmentCompletionChecklistResponse> {
    if (!assignmentIdParamSchema.safeParse(assignmentId).success) throw new MechanicOperationsError("INVALID_INPUT", "Assignment id must be a UUID.", 400);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const assignment = await repositories.assignments.findById(assignmentId);
      const request = assignment ? await repositories.serviceRequests.findById(assignment.requestId) : undefined;
      if (!assignment || !request) throw new MechanicOperationsError("NOT_FOUND", "Assignment not found.", 404);
      if (!actor.roles.includes("admin") && !(actor.roles.includes("rider") && request.riderId === actor.id) && !(actor.roles.includes("mechanic") && assignment.mechanicId === actor.id)) {
        throw new MechanicOperationsError("FORBIDDEN", "Completion checklist access is not allowed.", 403);
      }
      const checklist = await repositories.mechanicOperations.getLatestAssignmentCompletionChecklist(assignmentId);
      if (!checklist) throw new MechanicOperationsError("NOT_FOUND", "Completion checklist not found.", 404);
      return toAssignmentCompletionChecklistResponse(checklist);
    });
  }

  async updateEta(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AssignmentEtaMetadataResponse> {
    const normalizedIdempotencyKey = idempotencyKey.trim();
    if (normalizedIdempotencyKey.length < 8 || normalizedIdempotencyKey.length > 200) {
      throw new MechanicOperationsError(
        "INVALID_INPUT",
        "X-Idempotency-Key is required for assignment ETA updates.",
        400
      );
    }
    const parsedAssignmentId = assignmentIdParamSchema.safeParse(assignmentId);
    if (!parsedAssignmentId.success) {
      throw new MechanicOperationsError(
        "INVALID_INPUT",
        "Assignment id must be a valid UUID.",
        400,
        { issues: parsedAssignmentId.error.issues }
      );
    }
    const parsed = assignmentEtaInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new MechanicOperationsError("INVALID_INPUT", "ETA metadata input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }

    const now = this.options.now?.() ?? new Date();
    const normalized = normalizeEtaInput(parsed.data, now);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveMechanicActor(identity, repositories.users);
      const createId = this.options.createId ?? randomUUID;
      const scope = `POST /api/v1/assignments/${parsedAssignmentId.data}/eta`;
      const decision = await prepareIdempotency(repositories.idempotency, {
        actorId: actor.id,
        scope,
        idempotencyKey: normalizedIdempotencyKey,
        request: {
          ...(normalized.etaAtIso ? { eta_at: normalized.etaAtIso } : {}),
          ...(normalized.delayReason ? { delay_reason: normalized.delayReason } : {})
        },
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        id: createId()
      });

      if (decision.action === "conflict") {
        throw new MechanicOperationsError(
          "CONFLICT",
          "Idempotency key payload mismatch.",
          409
        );
      }
      if (decision.action === "in_progress") {
        throw new MechanicOperationsError(
          "CONFLICT",
          "Idempotency key is already in progress.",
          409
        );
      }
      if (decision.action === "replay") {
        return decision.responseBody as AssignmentEtaMetadataResponse;
      }

      const assignment = await repositories.mechanicOperations.findOwnedAssignmentForUpdate({
        assignmentId: parsedAssignmentId.data,
        mechanicId: actor.id
      });
      if (!assignment) {
        throw new MechanicOperationsError("NOT_FOUND", "Assignment not found.", 404);
      }
      if (!isActiveAssignmentStatus(assignment.status)) {
        throw new MechanicOperationsError(
          "CONFLICT",
          "Assignment ETA can only be updated for an active assignment.",
          409
        );
      }

      const metadata = await repositories.mechanicOperations.createAssignmentEtaMetadata({
        id: createId(),
        assignmentId: assignment.id,
        requestId: assignment.requestId,
        mechanicId: assignment.mechanicId,
        etaAt: normalized.etaAt,
        delayReason: normalized.delayReason,
        createdBy: actor.id,
        createdAt: now
      });
      await appendAssignmentAuditOutbox({
        action: "assignment.eta_updated",
        assignment,
        actorId: actor.id,
        actorRole: "mechanic",
        audit: repositories.audit,
        outbox: repositories.outbox,
        now,
        createId,
        extraPayload: {
          eta_metadata_id: metadata.id,
          ...(metadata.etaAt ? { eta_at: metadata.etaAt.toISOString() } : {}),
          ...(metadata.delayReason ? { delay_reason: metadata.delayReason } : {})
        }
      });

      const response = toAssignmentEtaMetadataResponse(metadata);
      await repositories.idempotency.complete({
        actorId: actor.id,
        scope,
        idempotencyKey: normalizedIdempotencyKey,
        responseStatus: 201,
        responseBody: response as unknown as Record<string, unknown>,
        resourceType: "assignment_eta_metadata",
        resourceId: metadata.id,
        completedAt: now
      });
      return response;
    });
  }

  async addMedia(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AssignmentMediaMetadataResponse> {
    const normalizedIdempotencyKey = idempotencyKey.trim();
    if (normalizedIdempotencyKey.length < 8 || normalizedIdempotencyKey.length > 200) {
      throw new MechanicOperationsError(
        "INVALID_INPUT",
        "X-Idempotency-Key is required for assignment media metadata.",
        400
      );
    }
    const parsedAssignmentId = assignmentIdParamSchema.safeParse(assignmentId);
    if (!parsedAssignmentId.success) {
      throw new MechanicOperationsError(
        "INVALID_INPUT",
        "Assignment id must be a valid UUID.",
        400,
        { issues: parsedAssignmentId.error.issues }
      );
    }
    const parsed = assignmentMediaInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new MechanicOperationsError(
        "INVALID_INPUT",
        "Assignment media metadata input is invalid.",
        400,
        { issues: parsed.error.issues }
      );
    }

    const now = this.options.now?.() ?? new Date();
    const normalized = normalizeMediaInput(parsed.data);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveMechanicActor(identity, repositories.users);
      const createId = this.options.createId ?? randomUUID;
      const scope = `POST /api/v1/assignments/${parsedAssignmentId.data}/media`;
      const decision = await prepareIdempotency(repositories.idempotency, {
        actorId: actor.id,
        scope,
        idempotencyKey: normalizedIdempotencyKey,
        request: {
          media_reference: normalized.mediaReference,
          purpose: normalized.purpose,
          content_type: normalized.contentType,
          size_bytes: normalized.sizeBytes,
          ...(normalized.checksum ? { checksum: normalized.checksum } : {})
        },
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        id: createId()
      });

      if (decision.action === "conflict") {
        throw new MechanicOperationsError(
          "CONFLICT",
          "Idempotency key payload mismatch.",
          409
        );
      }
      if (decision.action === "in_progress") {
        throw new MechanicOperationsError(
          "CONFLICT",
          "Idempotency key is already in progress.",
          409
        );
      }
      if (decision.action === "replay") {
        return decision.responseBody as AssignmentMediaMetadataResponse;
      }

      const assignment = await repositories.mechanicOperations.findOwnedAssignmentForUpdate({
        assignmentId: parsedAssignmentId.data,
        mechanicId: actor.id
      });
      if (!assignment) {
        throw new MechanicOperationsError("NOT_FOUND", "Assignment not found.", 404);
      }
      if (!isActiveAssignmentStatus(assignment.status)) {
        throw new MechanicOperationsError(
          "CONFLICT",
          "Assignment media can only be added for an active assignment.",
          409
        );
      }

      const metadata = await repositories.mechanicOperations.createAssignmentMediaMetadata({
        id: createId(),
        assignmentId: assignment.id,
        requestId: assignment.requestId,
        mechanicId: assignment.mechanicId,
        purpose: normalized.purpose,
        mediaReference: normalized.mediaReference,
        contentType: normalized.contentType,
        sizeBytes: normalized.sizeBytes,
        checksum: normalized.checksum,
        createdBy: actor.id,
        createdAt: now
      });
      await appendAssignmentAuditOutbox({
        action: "assignment.media_added",
        assignment,
        actorId: actor.id,
        actorRole: "mechanic",
        audit: repositories.audit,
        outbox: repositories.outbox,
        now,
        createId,
        extraPayload: {
          media_metadata_id: metadata.id,
          media_purpose: metadata.purpose,
          media_size_bytes: metadata.sizeBytes,
          content_type: metadata.contentType
        }
      });

      const response = toAssignmentMediaMetadataResponse(metadata);
      await repositories.idempotency.complete({
        actorId: actor.id,
        scope,
        idempotencyKey: normalizedIdempotencyKey,
        responseStatus: 201,
        responseBody: response as unknown as Record<string, unknown>,
        resourceType: "assignment_media_metadata",
        resourceId: metadata.id,
        completedAt: now
      });
      return response;
    });
  }

  async submitCompletionChecklist(
    identity: VerifiedSupabaseIdentity,
    assignmentId: string,
    input: unknown,
    idempotencyKey: string
  ): Promise<AssignmentCompletionChecklistResponse> {
    const normalizedIdempotencyKey = idempotencyKey.trim();
    if (normalizedIdempotencyKey.length < 8 || normalizedIdempotencyKey.length > 200) {
      throw new MechanicOperationsError(
        "INVALID_INPUT",
        "X-Idempotency-Key is required for assignment completion checklist.",
        400
      );
    }
    const parsedAssignmentId = assignmentIdParamSchema.safeParse(assignmentId);
    if (!parsedAssignmentId.success) {
      throw new MechanicOperationsError(
        "INVALID_INPUT",
        "Assignment id must be a valid UUID.",
        400,
        { issues: parsedAssignmentId.error.issues }
      );
    }
    const parsed = assignmentCompletionChecklistInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new MechanicOperationsError(
        "INVALID_INPUT",
        "Completion checklist input is invalid.",
        400,
        { issues: parsed.error.issues }
      );
    }

    const now = this.options.now?.() ?? new Date();
    const normalized = normalizeCompletionChecklistInput(parsed.data);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveMechanicActor(identity, repositories.users);
      const createId = this.options.createId ?? randomUUID;
      const scope = `POST /api/v1/assignments/${parsedAssignmentId.data}/completion-checklist`;
      const decision = await prepareIdempotency(repositories.idempotency, {
        actorId: actor.id,
        scope,
        idempotencyKey: normalizedIdempotencyKey,
        request: {
          work_summary: normalized.workSummary,
          safety_checklist: toChecklistResponseShape(normalized.safetyChecklist),
          ...(normalized.notes ? { notes: normalized.notes } : {})
        },
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        id: createId()
      });

      if (decision.action === "conflict") {
        throw new MechanicOperationsError(
          "CONFLICT",
          "Idempotency key payload mismatch.",
          409
        );
      }
      if (decision.action === "in_progress") {
        throw new MechanicOperationsError(
          "CONFLICT",
          "Idempotency key is already in progress.",
          409
        );
      }
      if (decision.action === "replay") {
        return decision.responseBody as AssignmentCompletionChecklistResponse;
      }

      const assignment = await repositories.mechanicOperations.findOwnedAssignmentForUpdate({
        assignmentId: parsedAssignmentId.data,
        mechanicId: actor.id
      });
      if (!assignment) {
        throw new MechanicOperationsError("NOT_FOUND", "Assignment not found.", 404);
      }
      if (!isActiveAssignmentStatus(assignment.status)) {
        throw new MechanicOperationsError(
          "CONFLICT",
          "Completion checklist can only be submitted for an active assignment.",
          409
        );
      }

      if (assignment.maintenanceLaborQuoteId && !["in_progress", "awaiting_payment"].includes(assignment.status)) {
        throw new MechanicOperationsError("CONFLICT", "Maintenance completion checklist requires work to have started.", 409);
      }
      const approved = assignment.maintenanceLaborQuoteId ? await repositories.quotes.findLatestApprovedByAssignment(assignment.id, "maintenance_work") : undefined;
      const checklist = await repositories.mechanicOperations.createAssignmentCompletionChecklist({
        id: createId(),
        assignmentId: assignment.id,
        requestId: assignment.requestId,
        mechanicId: assignment.mechanicId,
        approvedQuoteId: approved?.id,
        workSummary: normalized.workSummary,
        safetyChecklist: normalized.safetyChecklist,
        notes: normalized.notes,
        createdBy: actor.id,
        createdAt: now
      });
      await appendAssignmentAuditOutbox({
        action: "assignment.completion_checklist_submitted",
        assignment,
        actorId: actor.id,
        actorRole: "mechanic",
        audit: repositories.audit,
        outbox: repositories.outbox,
        now,
        createId,
        extraPayload: {
          completion_checklist_id: checklist.id,
          checklist_revision: checklist.revision,
          safety_check_count: Object.keys(toChecklistResponseShape(checklist.safetyChecklist))
            .length
        }
      });

      const response = toAssignmentCompletionChecklistResponse(checklist);
      await repositories.idempotency.complete({
        actorId: actor.id,
        scope,
        idempotencyKey: normalizedIdempotencyKey,
        responseStatus: 201,
        responseBody: response as unknown as Record<string, unknown>,
        resourceType: "assignment_completion_checklist",
        resourceId: checklist.id,
        completedAt: now
      });
      return response;
    });
  }
}

function normalizeEtaInput(input: AssignmentEtaInput, now: Date): {
  etaAt?: Date;
  etaAtIso?: string;
  delayReason?: string;
} {
  const etaAt = input.eta_at ? new Date(input.eta_at) : undefined;
  if (etaAt) {
    const offset = etaAt.getTime() - now.getTime();
    if (offset < MECHANIC_ETA_MIN_OFFSET_MS || offset > MECHANIC_ETA_MAX_OFFSET_MS) {
      throw new MechanicOperationsError(
        "INVALID_INPUT",
        "ETA must be at least one minute and no more than 24 hours in the future.",
        400
      );
    }
  }
  return {
    ...(etaAt ? { etaAt } : {}),
    ...(etaAt ? { etaAtIso: etaAt.toISOString() } : {}),
    ...(input.delay_reason ? { delayReason: input.delay_reason } : {})
  };
}

function normalizeMediaInput(input: AssignmentMediaInput): {
  mediaReference: string;
  purpose: AssignmentMediaInput["purpose"];
  contentType: string;
  sizeBytes: number;
  checksum?: string;
} {
  return {
    mediaReference: input.media_reference,
    purpose: input.purpose,
    contentType: input.content_type,
    sizeBytes: input.size_bytes,
    ...(input.checksum ? { checksum: input.checksum } : {})
  };
}

function normalizeCompletionChecklistInput(input: AssignmentCompletionChecklistInput): {
  workSummary: string;
  safetyChecklist: AssignmentCompletionChecklist["safetyChecklist"];
  notes?: string;
} {
  return {
    workSummary: input.work_summary,
    safetyChecklist: {
      testRideCompleted: input.safety_checklist.test_ride_completed,
      toolsRemoved: input.safety_checklist.tools_removed,
      areaSafe: input.safety_checklist.area_safe,
      riderBriefed: input.safety_checklist.rider_briefed,
      noFluidLeak: input.safety_checklist.no_fluid_leak
    },
    ...(input.notes ? { notes: input.notes } : {})
  };
}

function isActiveAssignmentStatus(status: string): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.includes(
    status as (typeof ACTIVE_ASSIGNMENT_STATUSES)[number]
  );
}

function toAssignmentCompletionChecklistResponse(
  checklist: AssignmentCompletionChecklist
): AssignmentCompletionChecklistResponse {
  return {
    id: checklist.id,
    assignment_id: checklist.assignmentId,
    request_id: checklist.requestId,
    mechanic_id: checklist.mechanicId,
    revision: checklist.revision,
    approved_quote_id: checklist.approvedQuoteId,
    work_summary: checklist.workSummary,
    safety_checklist: toChecklistResponseShape(checklist.safetyChecklist),
    ...(checklist.notes ? { notes: checklist.notes } : {}),
    created_at: checklist.createdAt.toISOString()
  };
}

export function toChecklistResponseShape(
  checklist: AssignmentCompletionChecklist["safetyChecklist"]
): AssignmentCompletionChecklistInput["safety_checklist"] {
  return {
    test_ride_completed: checklist.testRideCompleted,
    tools_removed: checklist.toolsRemoved,
    area_safe: checklist.areaSafe,
    rider_briefed: checklist.riderBriefed,
    no_fluid_leak: checklist.noFluidLeak
  };
}

function toAssignmentMediaMetadataResponse(
  metadata: AssignmentMediaMetadata
): AssignmentMediaMetadataResponse {
  return {
    id: metadata.id,
    assignment_id: metadata.assignmentId,
    request_id: metadata.requestId,
    mechanic_id: metadata.mechanicId,
    purpose: metadata.purpose,
    media_reference: metadata.mediaReference,
    content_type: metadata.contentType,
    size_bytes: metadata.sizeBytes,
    ...(metadata.checksum ? { checksum: metadata.checksum } : {}),
    created_at: metadata.createdAt.toISOString()
  };
}

function toAssignmentEtaMetadataResponse(
  metadata: AssignmentEtaMetadata
): AssignmentEtaMetadataResponse {
  return {
    id: metadata.id,
    assignment_id: metadata.assignmentId,
    request_id: metadata.requestId,
    mechanic_id: metadata.mechanicId,
    ...(metadata.etaAt ? { eta_at: metadata.etaAt.toISOString() } : {}),
    ...(metadata.delayReason ? { delay_reason: metadata.delayReason } : {}),
    created_at: metadata.createdAt.toISOString()
  };
}
