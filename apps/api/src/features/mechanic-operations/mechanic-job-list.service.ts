import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/server/repositories/contracts/assignment.repository";
import { toAssignmentResponse, type AssignmentResponse } from "@/features/assignments/assignment.service";
import { toQuoteResponse, type QuoteResponse } from "@/features/quotes/quote.service";
import { toChecklistResponseShape, type AssignmentCompletionChecklistResponse } from "./mechanic-assignment-metadata.service";

import { loadActiveMechanicActor } from "./mechanic-operations.authorization";
import { MechanicOperationsError } from "./mechanic-operations.errors";
import {
  decodeCursor,
  toJobPageResponse,
  type MechanicJobPageResponse
} from "./mechanic-operations.mappers";
import { assignmentIdParamSchema, mechanicJobListQuerySchema } from "./mechanic-operations.schemas";

export type MechanicJobDetailResponse = {
  assignment: AssignmentResponse;
  request: { id: string; request_code: string; service_type: string; fulfillment_mode?: string; status: string;
    problem_description: string; scheduled_start_at?: string; location?: { latitude: number; longitude: number }; address_text?: string };
  motorcycle?: { id: string; brand_text: string; model_text: string; year?: number; license_plate?: string };
  latest_quote?: QuoteResponse;
  agreements: { rescue_labor?: QuoteResponse; maintenance_labor?: QuoteResponse; rescue_payment_timing?: string };
  completion_checklist?: Pick<AssignmentCompletionChecklistResponse, "id" | "revision" | "approved_quote_id" | "work_summary" | "safety_checklist" | "created_at">;
  media: { items: { upload_intent_id: string; media_metadata_id: string; resource_type: string; purpose: string;
    content_type: string; size_bytes: number; created_at: string }[]; has_more: boolean };
  sensitive_details_redacted: boolean;
};

export class MechanicJobListService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async getJob(identity: VerifiedSupabaseIdentity, assignmentId: string): Promise<MechanicJobDetailResponse> {
    if (!assignmentIdParamSchema.safeParse(assignmentId).success) throw new MechanicOperationsError("INVALID_INPUT", "Assignment ID must be a UUID.", 400);
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveMechanicActor(identity, repositories.users);
      const snapshot = await repositories.assignments.findById(assignmentId);
      if (!snapshot) throw new MechanicOperationsError("NOT_FOUND", "Assignment not found.", 404);
      if (snapshot.mechanicId !== actor.id) throw new MechanicOperationsError("FORBIDDEN", "Assignment ownership is required.", 403);
      // Serialize with recovery/cancellation so terminal redaction uses the state read for this response.
      const request = await repositories.serviceRequests.findByIdForUpdate(snapshot.requestId);
      if (!request) throw new MechanicOperationsError("NOT_FOUND", "Service request not found.", 404);
      const assignment = await repositories.assignments.findByIdForUpdate(assignmentId);
      const currentActor = await loadActiveMechanicActor(identity, repositories.users);
      if (!assignment || assignment.mechanicId !== currentActor.id || assignment.requestId !== request.id) {
        throw new MechanicOperationsError("FORBIDDEN", "Assignment ownership is required.", 403);
      }
      const active = ACTIVE_ASSIGNMENT_STATUSES.some((status) => status === assignment.status);
      // A single job uses a fixed number of queries; media is capped and quote history is never loaded.
      const motorcycle = await repositories.motorcycles.findById(request.motorcycleId);
      const latest = await repositories.quotes.findLatestByAssignment(assignment.id);
      const rescue = assignment.rescueLaborQuoteId ? await repositories.quotes.findById(assignment.rescueLaborQuoteId) : undefined;
      const maintenance = assignment.maintenanceLaborQuoteId ? await repositories.quotes.findById(assignment.maintenanceLaborQuoteId) : undefined;
      const checklist = await repositories.mechanicOperations.getLatestAssignmentCompletionChecklist(assignment.id);
      const media = active ? await repositories.mediaUploadIntents.listFinalizedForJob({ requestId: request.id, assignmentId: assignment.id, limit: 21 }) : [];
      return {
        assignment: toAssignmentResponse(assignment),
        request: { id: request.id, request_code: request.requestCode, service_type: request.serviceType, fulfillment_mode: request.fulfillmentMode,
          status: request.status, problem_description: request.problemDescription, scheduled_start_at: request.scheduledStartAt?.toISOString(),
          ...(active ? { location: request.serviceLocation, address_text: request.addressText } : {}) },
        ...(motorcycle && motorcycle.riderId === request.riderId ? { motorcycle: { id: motorcycle.id, brand_text: motorcycle.brandText,
          model_text: motorcycle.modelText, year: motorcycle.year, ...(active ? { license_plate: motorcycle.licensePlate } : {}) } } : {}),
        ...(latest ? { latest_quote: toQuoteResponse(latest) } : {}),
        agreements: {
          ...(rescue?.assignmentId === assignment.id ? { rescue_labor: toQuoteResponse(rescue), rescue_payment_timing: assignment.rescuePaymentTiming } : {}),
          ...(maintenance?.assignmentId === assignment.id ? { maintenance_labor: toQuoteResponse(maintenance) } : {}) },
        ...(checklist ? { completion_checklist: { id: checklist.id, revision: checklist.revision, approved_quote_id: checklist.approvedQuoteId,
          work_summary: checklist.workSummary, safety_checklist: toChecklistResponseShape(checklist.safetyChecklist), created_at: checklist.createdAt.toISOString() } } : {}),
        media: { items: media.slice(0, 20).map((item) => ({ upload_intent_id: item.id, media_metadata_id: item.mediaMetadataId!,
          resource_type: item.resourceType, purpose: item.purpose, content_type: item.contentType, size_bytes: item.sizeBytes, created_at: item.createdAt.toISOString() })),
          has_more: media.length > 20 },
        sensitive_details_redacted: !active
      };
    });
  }

  async listJobs(
    identity: VerifiedSupabaseIdentity,
    query: unknown
  ): Promise<MechanicJobPageResponse> {
    const filters = parseJobFilters(query);
    return this.unitOfWork.execute(async ({ mechanicOperations, users }) => {
      const actor = await loadActiveMechanicActor(identity, users);
      const page = await mechanicOperations.listJobs({
        mechanicId: actor.id,
        limit: filters.limit,
        ...(filters.cursor ? { cursor: filters.cursor } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.activeOnly !== undefined ? { activeOnly: filters.activeOnly } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {})
      });
      return toJobPageResponse(page.items, filters.limit, page.nextCursor);
    });
  }
}

function parseJobFilters(input: unknown) {
  const parsed = mechanicJobListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new MechanicOperationsError("INVALID_INPUT", "Mechanic job filters are invalid.", 400, {
      issues: parsed.error.issues
    });
  }
  try {
    return {
      limit: parsed.data.limit,
      ...(parsed.data.cursor ? { cursor: decodeCursor(parsed.data.cursor) } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.active_only !== undefined ? { activeOnly: parsed.data.active_only } : {}),
      ...(parsed.data.date_from ? { dateFrom: new Date(parsed.data.date_from) } : {}),
      ...(parsed.data.date_to ? { dateTo: new Date(parsed.data.date_to) } : {})
    };
  } catch {
    throw new MechanicOperationsError("INVALID_INPUT", "Mechanic job cursor is invalid.", 400);
  }
}
