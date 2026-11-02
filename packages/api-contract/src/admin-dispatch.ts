import { z } from "zod";

import { cursorPageSchema, adminReasonValueSchema } from "./common";

/**
 * Response schemas for the admin dispatch reads under
 * `/api/v1/admin/service-requests/[requestId]/dispatch/**` and
 * `/api/v1/admin/dispatch/rounds/**`.
 *
 * Shapes mirror `DispatchService.readAdminDispatch` and `readAdminRound` in
 * `apps/api/src/features/dispatch/dispatch.service.ts` (lines 77-147).
 *
 * `next_action_codes` and `reason_codes` are backend decisions. The frontend
 * MUST render dispatch buttons from `next_action_codes` rather than guessing.
 */

export const adminDispatchRoundStatuses = [
  "active",
  "expired",
  "completed",
  "canceled"
] as const;

export const adminDispatchCandidateStatuses = [
  "offered",
  "accepted",
  "declined",
  "expired",
  "rejected",
  "canceled"
] as const;

/** `toCandidateResponse` (service lines 845-856). */
export const adminDispatchCandidateSchema = z.object({
  id: z.string(),
  round_id: z.string(),
  request_id: z.string(),
  mechanic_id: z.string(),
  rank: z.number().int(),
  distance_m: z.number().optional(),
  status: z.string(),
  expires_at: z.string().optional()
});

/** `toRoundResponse` (service lines 830-843). */
export const adminDispatchRoundSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  round_number: z.number().int(),
  radius_m: z.number(),
  status: z.string(),
  expires_at: z.string(),
  candidates: z.array(adminDispatchCandidateSchema)
});

/**
 * The dispatch status / rounds / eligible / explanation views share the same
 * summary block (`dispatch.service.ts:109-113`).
 */
export const adminDispatchSummarySchema = z.object({
  request_id: z.string(),
  request_status: z.string(),
  episode_start_round: z.number().int(),
  retry_count: z.number().int(),
  max_retry_count: z.number().int(),
  round_history_count: z.number().int(),
  round_history_has_more: z.boolean(),
  episode_round_count: z.number().int(),
  max_rounds_per_episode: z.number().int(),
  reason_codes: z.array(z.string()),
  next_action_codes: z.array(z.string()),
  active_round: adminDispatchRoundSchema.optional()
});

/** The `status` view returns only the summary. */
export const adminDispatchStatusSchema = adminDispatchSummarySchema;

/**
 * The `rounds` view returns the summary plus a page of rounds.
 * (`dispatch.service.ts:88-89`).
 */
export const adminDispatchRoundsSchema = adminDispatchSummarySchema.extend({
  items: z.array(adminDispatchRoundSchema),
  page: z.object({
    limit: z.number().int().positive(),
    has_more: z.boolean(),
    next_cursor: z.string().optional()
  })
});

/**
 * The `eligible` / `explanation` views return the summary plus a page of
 * eligibility rows (`dispatch.service.ts:127-132`).
 */
export const adminDispatchEligibilityItemSchema = z.object({
  mechanic_id: z.string(),
  eligible: z.boolean(),
  reason_codes: z.array(z.string()),
  distance_m: z.number().optional(),
  rating_avg: z.number(),
  rating_count: z.number()
});

export const adminDispatchEligibilitySchema = adminDispatchSummarySchema.extend({
  evaluation: z.enum(["new_episode", "next_round"]),
  radius_m: z.number(),
  items: z.array(adminDispatchEligibilityItemSchema),
  page: z.object({
    limit: z.number().int().positive(),
    has_more: z.boolean(),
    next_cursor: z.string().optional()
  }),
  reason_counts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  reason_counts_scope: z.literal("page").optional()
});

/** `readAdminRound` (service lines 136-146). */
export const adminDispatchRoundDetailSchema = adminDispatchRoundSchema.extend({
  candidates_has_more: z.boolean(),
  worker_lease_active: z.boolean()
});

export type AdminDispatchRound = z.infer<typeof adminDispatchRoundSchema>;
export type AdminDispatchCandidate = z.infer<typeof adminDispatchCandidateSchema>;
export type AdminDispatchSummary = z.infer<typeof adminDispatchSummarySchema>;
export type AdminDispatchEligibilityItem = z.infer<
  typeof adminDispatchEligibilityItemSchema
>;
export type AdminDispatchRoundDetail = z.infer<
  typeof adminDispatchRoundDetailSchema
>;

/** Query for the `rounds` / `eligible` / `explanation` views. */
export const adminDispatchPageQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

/** The `status` view rejects any query parameter. */
export const adminDispatchStatusQuerySchema = z.object({}).strict();

/**
 * Body for `POST .../dispatch/retry`, `POST .../dispatch/cancel` and
 * `POST /api/v1/admin/dispatch/rounds/[roundId]/expire`.
 */
export const adminDispatchCommandSchema = z
  .object({ reason: adminReasonValueSchema })
  .strict();

export { cursorPageSchema };
