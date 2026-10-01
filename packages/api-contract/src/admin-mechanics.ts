import { z } from "zod";

import { cursorPageSchema, adminReasonValueSchema } from "./common";
import { serviceTypes } from "./enums";

/**
 * Response schemas for `/api/v1/admin/mechanics/**`.
 *
 * Shapes mirror `AdminMechanicManagementService` in
 * `apps/api/src/features/admin/admin-mechanic-management.service.ts`.
 *
 * Note: the mechanic-facing value sets below are TS-only business rules. They
 * are NOT PostgreSQL enums, so they intentionally live here rather than in
 * `enums.ts`.
 */

export const mechanicProfileStatuses = [
  "pending",
  "active",
  "rejected",
  "suspended",
  "banned"
] as const;

export const mechanicLocationFreshnessValues = ["fresh", "stale", "missing"] as const;

export const mechanicWorkStateValues = ["idle", "active_assignment"] as const;

/** `AdminMechanicSummaryResponse` (service lines 32-44). */
export const adminMechanicSummarySchema = z.object({
  user_id: z.string(),
  profile_status: z.enum(mechanicProfileStatuses),
  is_available: z.boolean(),
  service_radius_km: z.number(),
  service_types: z.array(z.enum(serviceTypes)),
  location_freshness: z.enum(mechanicLocationFreshnessValues),
  work_state: z.enum(mechanicWorkStateValues),
  rating_avg: z.number(),
  rating_count: z.number(),
  availability_updated_at: z.string(),
  created_at: z.string(),
  updated_at: z.string()
});

/** `AdminMechanicPerformanceResponse` (service lines 59-72). */
export const adminMechanicPerformanceSchema = z.object({
  mechanic_id: z.string(),
  assignments: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    canceled: z.number().int().nonnegative()
  }),
  trusted_rating: z.object({
    average: z.number(),
    count: z.number().int().nonnegative()
  })
});

/**
 * `AdminMechanicWorkHistoryResponse` (service lines 46-57).
 *
 * The `status` field is an `AssignmentStatus`, not a request status.
 */
export const adminMechanicWorkHistorySchema = z.object({
  assignment_id: z.string(),
  request_id: z.string(),
  status: z.string(),
  accepted_at: z.string(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  canceled_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string()
});

export const adminMechanicListResponseSchema = cursorPageSchema(adminMechanicSummarySchema);
export const adminMechanicWorkHistoryListResponseSchema =
  cursorPageSchema(adminMechanicWorkHistorySchema);

export type AdminMechanicSummary = z.infer<typeof adminMechanicSummarySchema>;
export type AdminMechanicPerformance = z.infer<typeof adminMechanicPerformanceSchema>;
export type AdminMechanicWorkHistory = z.infer<typeof adminMechanicWorkHistorySchema>;
export type AdminMechanicListResponse = z.infer<typeof adminMechanicListResponseSchema>;

/** `GET /api/v1/admin/mechanics` query filters. */
export const adminMechanicListQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  profile_status: z.enum(mechanicProfileStatuses).optional(),
  service_type: z.enum(serviceTypes).optional(),
  is_available: z.coerce.boolean().optional(),
  location_freshness: z.enum(mechanicLocationFreshnessValues).optional(),
  work_state: z.enum(mechanicWorkStateValues).optional()
});

/** Status-change body shared by approve/reject/suspend/ban/reactivate. */
export const adminMechanicStatusMutationSchema = z
  .object({ reason: adminReasonValueSchema })
  .strict();

/** `POST /api/v1/admin/mechanics/[mechanicId]/skills` body. */
export const adminMechanicSkillsMutationSchema = z
  .object({
    reason: adminReasonValueSchema,
    service_types: z.array(z.enum(serviceTypes)).min(1).max(serviceTypes.length)
  })
  .strict();

/** `POST /api/v1/admin/mechanics/[mechanicId]/service-radius` body. */
export const adminMechanicRadiusMutationSchema = z
  .object({
    reason: adminReasonValueSchema,
    service_radius_km: z.number().positive().max(100)
  })
  .strict();

/**
 * `POST /api/v1/admin/mechanics/[mechanicId]/force-unavailable` body.
 *
 * The endpoint only accepts `reason`; it unconditionally marks the mechanic
 * unavailable (`admin-mechanic-management.service.ts:349-358` uses
 * `parseReason`, not a schema containing `is_available`).
 */
export const adminMechanicForceUnavailableMutationSchema = z
  .object({ reason: adminReasonValueSchema })
  .strict();
