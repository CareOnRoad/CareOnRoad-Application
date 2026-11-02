import { z } from "zod";

import { cursorPageSchema, adminReasonValueSchema } from "./common";

/**
 * Response schemas for `/api/v1/admin/assignments/**`.
 *
 * Shapes mirror `AdminAssignmentService` in
 * `apps/api/src/features/admin/admin-assignment.service.ts` and
 * `AdminSupervisionService` (the diagnosis view).
 *
 * IMPORTANT — `next_action_codes` is the backend's own decision about which
 * administrative commands are legal for the current assignment state. The
 * frontend MUST use it to decide which buttons to render instead of
 * re-deriving the rules (see `admin-assignment.service.ts:52`).
 */

export const adminAssignmentStatuses = [
  "accepted",
  "en_route",
  "on_site",
  "diagnosis",
  "quoted",
  "awaiting_payment",
  "in_service",
  "completed",
  "canceled",
  "recovery_canceled"
] as const;

export const adminAssignmentWorkSlots = [
  "current",
  "future_reservation",
  "closed"
] as const;

export const adminAssignmentSourceValues = ["offer", "manual", "recovery"] as const;

export const adminAssignmentSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  mechanic_id: z.string(),
  accepted_candidate_id: z.string().nullish(),
  source: z.string(),
  supersedes_assignment_id: z.string().nullish(),
  scheduled_start_at: z.string().optional(),
  reservation_start_at: z.string().optional(),
  reservation_end_at: z.string().optional(),
  activated_at: z.string().optional(),
  appointment_status: z.string().optional(),
  rescue_labor_quote_id: z.string().nullish(),
  rescue_payment_timing: z.string().nullish(),
  maintenance_labor_quote_id: z.string().nullish(),
  status: z.string(),
  accepted_at: z.string(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  canceled_at: z.string().optional()
});

/**
 * The detail view (`admin-assignment.service.ts:50-53`) adds the request
 * status, the work slot, the reason codes that block administrative actions
 * and the backend-computed legal next actions.
 */
export const adminAssignmentDetailSchema = adminAssignmentSchema.extend({
  request_status: z.string(),
  work_slot: z.enum(adminAssignmentWorkSlots),
  commitment_reason_codes: z.array(z.string()),
  next_action_codes: z.array(z.string())
});

/** The timeline view mixes assignment status changes and admin audit rows. */
export const adminAssignmentTimelineItemSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  type: z.string(),
  from_status: z.string().optional(),
  to_status: z.string().optional(),
  actor_id: z.string().optional(),
  action: z.string().optional()
});

/**
 * The diagnosis view (`admin-supervision.service.ts:38-42`). `history` holds
 * audit rows for the diagnosis; `supervision` holds the admin supervision
 * action log.
 */
export const adminSupervisionActionSchema = z.object({
  id: z.string(),
  admin_id: z.string(),
  request_id: z.string().optional(),
  assignment_id: z.string().optional(),
  quote_id: z.string().optional(),
  diagnosis_id: z.string().optional(),
  action: z.string(),
  created_at: z.string()
});

export const adminAssignmentDiagnosisSchema = z.object({
  id: z.string(),
  assignment_id: z.string(),
  request_id: z.string(),
  mechanic_id: z.string(),
  has_diagnosis: z.boolean(),
  has_recommended_work: z.boolean(),
  has_safety_notes: z.boolean(),
  immutable: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  history: cursorPageSchema(
    z.object({
      id: z.string(),
      action: z.string(),
      actor_id: z.string(),
      created_at: z.string()
    })
  ),
  supervision: cursorPageSchema(adminSupervisionActionSchema)
});

export const adminAssignmentDetailResponseSchema = adminAssignmentDetailSchema;
export const adminAssignmentTimelineResponseSchema = cursorPageSchema(
  adminAssignmentTimelineItemSchema
);
export const adminSupervisionActionListResponseSchema = cursorPageSchema(
  adminSupervisionActionSchema
);

export type AdminAssignment = z.infer<typeof adminAssignmentSchema>;
export type AdminAssignmentDetail = z.infer<typeof adminAssignmentDetailSchema>;
export type AdminAssignmentTimelineItem = z.infer<
  typeof adminAssignmentTimelineItemSchema
>;
export type AdminSupervisionAction = z.infer<typeof adminSupervisionActionSchema>;
export type AdminAssignmentDiagnosis = z.infer<
  typeof adminAssignmentDiagnosisSchema
>;

/** `GET /api/v1/admin/assignments/[assignmentId]` accepts no query. */
export const adminAssignmentDetailQuerySchema = z.object({}).strict();

/** `GET /api/v1/admin/assignments/[assignmentId]/timeline` query. */
export const adminAssignmentTimelineQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

/** `POST /api/v1/admin/assignments/[assignmentId]/cancel` body. */
export const adminAssignmentCancelSchema = z
  .object({ reason: adminReasonValueSchema })
  .strict();

/** `POST /api/v1/admin/assignments/[assignmentId]/notes` body. */
export const adminAssignmentNoteSchema = z
  .object({
    reason: adminReasonValueSchema,
    note: z.string().trim().min(1).max(2000)
  })
  .strict();

/**
 * `POST /api/v1/admin/assignments/[assignmentId]/reassign` and
 * `POST /api/v1/admin/service-requests/[requestId]/dispatch/manual-assign`
 * body (`admin-assignment.service.ts:16`).
 */
export const adminAssignmentMechanicCommandSchema = z
  .object({
    reason: adminReasonValueSchema,
    mechanic_id: z.string().uuid(),
    estimated_duration_minutes: z.number().int().min(15).max(480).optional()
  })
  .strict();

/**
 * `POST /api/v1/admin/assignments/[assignmentId]/resolve-stuck` body
 * (`admin-assignment.service.ts:18`). `investigate` requires a note.
 */
export const adminAssignmentResolveStuckSchema = z
  .object({
    reason: adminReasonValueSchema,
    action: z.enum(["cancel", "reassign", "investigate"]),
    mechanic_id: z.string().uuid().optional(),
    estimated_duration_minutes: z.number().int().min(15).max(480).optional(),
    note: z.string().trim().min(1).max(2000).optional()
  })
  .strict()
  .refine((value) => value.action !== "investigate" || Boolean(value.note), {
    message: "An investigation note is required.",
    path: ["note"]
  });
