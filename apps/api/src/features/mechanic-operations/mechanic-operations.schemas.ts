import { z } from "zod";

import type { AssignmentStatus } from "@/server/repositories/contracts/assignment.repository";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/server/repositories/contracts/assignment.repository";

export const MECHANIC_OPERATIONS_DEFAULT_LIMIT = 50;
export const MECHANIC_OPERATIONS_MAX_LIMIT = 100;
export const MECHANIC_ETA_MIN_OFFSET_MS = 60_000;
export const MECHANIC_ETA_MAX_OFFSET_MS = 24 * 60 * 60 * 1000;
export const MECHANIC_MEDIA_MAX_SIZE_BYTES = 25_000_000;

export const mechanicNextActionCodes = [
  "go_available",
  "update_location",
  "review_offer",
  "continue_active_job",
  "no_action"
] as const;

export type MechanicNextActionCode = (typeof mechanicNextActionCodes)[number];

export const mechanicJobStatuses = [
  "accepted",
  "en_route",
  "on_site",
  "diagnosis",
  "quoted",
  "awaiting_payment",
  "in_progress",
  "completed",
  "canceled"
] as const satisfies readonly AssignmentStatus[];

const booleanQuerySchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().optional());

const dateRangeFields = {
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional()
} as const;

export const mechanicPaginationSchema = z
  .object({
    cursor: z.string().trim().min(1).max(500).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MECHANIC_OPERATIONS_MAX_LIMIT)
      .default(MECHANIC_OPERATIONS_DEFAULT_LIMIT)
  })
  .strict();

export const mechanicJobListQuerySchema = mechanicPaginationSchema
  .extend({
    status: z.enum(mechanicJobStatuses).optional(),
    active_only: booleanQuerySchema,
    ...dateRangeFields
  })
  .refine(
    ({ date_from, date_to }) =>
      !date_from || !date_to || new Date(date_from).getTime() <= new Date(date_to).getTime(),
    {
      message: "The start date must not be after the end date.",
      path: ["date_to"]
    }
  );

export const mechanicPerformanceQuerySchema = z
  .object(dateRangeFields)
  .strict()
  .refine(
    ({ date_from, date_to }) =>
      !date_from || !date_to || new Date(date_from).getTime() <= new Date(date_to).getTime(),
    {
      message: "The start date must not be after the end date.",
      path: ["date_to"]
    }
  );

export const assignmentIdParamSchema = z.string().uuid();

export const assignmentEtaInputSchema = z
  .object({
    eta_at: z.string().datetime({ offset: true }).optional(),
    delay_reason: z.string().trim().min(1).max(500).optional()
  })
  .strict()
  .refine((input) => input.eta_at !== undefined || input.delay_reason !== undefined, {
    message: "Either eta_at or delay_reason is required.",
    path: ["eta_at"]
  });

export const assignmentMediaPurposes = ["diagnosis", "work_proof", "safety", "other"] as const;

const prohibitedRawMediaFields = [
  "raw_media",
  "rawMedia",
  "base64",
  "data",
  "bytes",
  "blob",
  "buffer",
  "file",
  "provider_payload",
  "providerPayload"
] as const;

export const assignmentMediaInputSchema = z
  .object({
    media_reference: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .refine((value) => !/^data:/i.test(value) && !/;base64,/i.test(value), {
        message: "Media reference must be metadata only, not an inline raw payload."
      }),
    purpose: z.enum(assignmentMediaPurposes),
    content_type: z.string().trim().min(1).max(200),
    size_bytes: z.number().int().min(1).max(MECHANIC_MEDIA_MAX_SIZE_BYTES),
    checksum: z.string().trim().min(1).max(200).optional()
  })
  .strict()
  .superRefine((input, context) => {
    for (const field of prohibitedRawMediaFields) {
      if (field in input) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Raw media payloads are not accepted by this endpoint.",
          path: [field]
        });
      }
    }
  });

export const assignmentSafetyChecklistSchema = z
  .object({
    test_ride_completed: z.boolean(),
    tools_removed: z.boolean(),
    area_safe: z.boolean(),
    rider_briefed: z.boolean(),
    no_fluid_leak: z.boolean()
  })
  .strict();

export const assignmentCompletionChecklistInputSchema = z
  .object({
    work_summary: z.string().trim().min(10).max(3000),
    safety_checklist: assignmentSafetyChecklistSchema,
    notes: z.string().trim().min(1).max(1000).optional()
  })
  .strict();

export type MechanicJobListQueryInput = z.infer<typeof mechanicJobListQuerySchema>;
export type MechanicPerformanceQueryInput = z.infer<typeof mechanicPerformanceQuerySchema>;
export type AssignmentEtaInput = z.infer<typeof assignmentEtaInputSchema>;
export type AssignmentMediaInput = z.infer<typeof assignmentMediaInputSchema>;
export type AssignmentCompletionChecklistInput = z.infer<
  typeof assignmentCompletionChecklistInputSchema
>;

export function isActiveMechanicJobStatus(status: AssignmentStatus): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.includes(
    status as (typeof ACTIVE_ASSIGNMENT_STATUSES)[number]
  );
}
