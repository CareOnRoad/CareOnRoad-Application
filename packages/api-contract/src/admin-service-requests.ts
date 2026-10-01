import { z } from "zod";

import { cursorPageSchema, adminReasonValueSchema } from "./common";
import { serviceTypes } from "./enums";

/**
 * Response schemas for `/api/v1/admin/service-requests/**`.
 *
 * Shapes mirror `AdminServiceRequestService` in
 * `apps/api/src/features/admin/admin-service-request.service.ts`.
 *
 * `requestStatuses` / `requestPriorities` below are TS-only business rules
 * (no PostgreSQL enum), so they live here rather than in `enums.ts`. They do
 * match `RequestStatus` / `RequestPriority` in
 * `server/repositories/contracts/service-request.repository.ts`.
 */

export const requestStatuses = [
  "submitted",
  "dispatching",
  "offered",
  "assigned",
  "mechanic_en_route",
  "in_service",
  "awaiting_quote_approval",
  "awaiting_payment",
  "completed",
  "manual_escalation",
  "canceled"
] as const;

export const requestPriorities = ["normal", "high", "emergency"] as const;

export const fulfillmentModes = ["immediate_location", "scheduled_visit"] as const;

/** `AdminServiceRequestSummaryResponse` (service lines 39-53). */
export const adminRequestSummarySchema = z.object({
  id: z.string(),
  request_code: z.string(),
  rider_id: z.string(),
  motorcycle_id: z.string(),
  service_type: z.enum(serviceTypes),
  fulfillment_mode: z.enum(fulfillmentModes).optional(),
  status: z.enum(requestStatuses),
  priority: z.enum(requestPriorities),
  mechanic_id: z.string().optional(),
  scheduled_start_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string()
});

/** `AdminRequestAssignmentResponse` (service lines 74-86). */
export const adminRequestAssignmentSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  mechanic_id: z.string(),
  status: z.string(),
  accepted_at: z.string(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  canceled_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string()
});

/** `AdminRequestQuoteResponse` (service lines 88-99). */
export const adminRequestQuoteSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  assignment_id: z.string(),
  version: z.number().int(),
  status: z.string(),
  currency: z.literal("VND"),
  subtotal_amount: z.number(),
  discount_amount: z.number(),
  total_amount: z.number(),
  expires_at: z.string().optional(),
  created_at: z.string(),
  responded_at: z.string().optional()
});

/**
 * `AdminServiceRequestDetailResponse` (service lines 55-72): the summary plus
 * optional nested dispatch / assignment / quote / reminder blocks.
 */
export const adminRequestDetailSchema = adminRequestSummarySchema.extend({
  dispatch: z
    .object({
      round_id: z.string(),
      round_number: z.number().int(),
      status: z.string(),
      started_at: z.string(),
      expires_at: z.string(),
      completed_at: z.string().optional(),
      open_candidate_count: z.number().int().nonnegative()
    })
    .optional(),
  assignment: adminRequestAssignmentSchema.optional(),
  latest_quote: adminRequestQuoteSchema.optional(),
  reminder: z
    .object({
      reminder_id: z.string(),
      occurrence_id: z.string().optional()
    })
    .optional()
});

/** `AdminRequestTimelineResponse` — a status transition OR an internal note. */
export const adminRequestTimelineItemSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("status"),
    from_status: z.enum(requestStatuses).optional(),
    to_status: z.enum(requestStatuses),
    actor_id: z.string().optional(),
    reason: z.string().optional(),
    created_at: z.string()
  }),
  z.object({
    id: z.string(),
    kind: z.literal("internal_note"),
    admin_id: z.string(),
    note: z.string(),
    created_at: z.string()
  })
]);

/** `AdminRequestMediaResponse` (service lines 119-127). */
export const adminRequestMediaSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  media_type: z.string(),
  content_type: z.string(),
  size_bytes: z.number().int().optional(),
  created_by: z.string(),
  created_at: z.string()
});

/** `AdminRequestNoteResponse` (service lines 129-136). */
export const adminRequestNoteSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  admin_id: z.string(),
  note: z.string(),
  created_at: z.string()
});

export const adminRequestListResponseSchema = cursorPageSchema(adminRequestSummarySchema);
export const adminRequestTimelineResponseSchema = cursorPageSchema(
  adminRequestTimelineItemSchema
);
export const adminRequestMediaListResponseSchema = cursorPageSchema(adminRequestMediaSchema);

export type AdminRequestSummary = z.infer<typeof adminRequestSummarySchema>;
export type AdminRequestDetail = z.infer<typeof adminRequestDetailSchema>;
export type AdminRequestTimelineItem = z.infer<typeof adminRequestTimelineItemSchema>;
export type AdminRequestMedia = z.infer<typeof adminRequestMediaSchema>;
export type AdminRequestNote = z.infer<typeof adminRequestNoteSchema>;

/** `GET /api/v1/admin/service-requests` query filters. */
export const adminRequestListQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(requestStatuses).optional(),
  service_type: z.enum(serviceTypes).optional(),
  priority: z.enum(requestPriorities).optional(),
  rider_id: z.string().uuid().optional(),
  mechanic_id: z.string().uuid().optional(),
  request_code: z.string().trim().min(1).max(40).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

/** Body for cancel / manual-escalate (`adminReasonSchema`). */
export const adminRequestCommandSchema = z
  .object({ reason: adminReasonValueSchema })
  .strict();

/** `POST /api/v1/admin/service-requests/[requestId]/notes` body. */
export const adminRequestNoteMutationSchema = z
  .object({
    reason: adminReasonValueSchema,
    note: z.string().trim().min(1).max(2000)
  })
  .strict();
