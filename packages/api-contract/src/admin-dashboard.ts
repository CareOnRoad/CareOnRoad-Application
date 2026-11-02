import { z } from "zod";

import { cursorPageSchema } from "./common";

/**
 * Response schemas for `/api/v1/admin/dashboard/**`.
 *
 * Shapes mirror `AdminDashboardService` in
 * `apps/api/src/features/admin/admin-dashboard.service.ts`.
 *
 * The `groups` value is a bucket histogram produced by one SQL aggregation
 * (`admin-query.repository.ts:121-136`): every group is
 * `Record<bucket, count>`. Buckets are derived from database columns at
 * runtime (status text, an availability boolean, a worker name), so the keys
 * are NOT a closed set — a new status in the database appears as a new key.
 * The frontend must therefore read a bucket defensively.
 */

export const adminDashboardGroupsSchema = z.record(
  z.string(),
  z.record(z.string(), z.number().int().nonnegative())
);

export const adminDashboardSummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  scope: z.literal("created_in_window"),
  groups: adminDashboardGroupsSchema
});

/** `stuck-workflows` view (service lines 22-29). */
export const adminStuckWorkflowSchema = z.object({
  id: z.string(),
  target_id: z.string(),
  request_id: z.string().optional(),
  assignment_id: z.string().optional(),
  category: z.string(),
  age_seconds: z.number().int().nonnegative(),
  failure_count: z.number().int().optional(),
  active_lease: z.boolean(),
  next_action_codes: z.array(z.string()),
  detected_basis_at: z.string()
});

export const adminStuckWorkflowsResponseSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    thresholds: z.record(z.string(), z.number()),
    page: z.object({
      limit: z.number().int().positive(),
      has_more: z.boolean(),
      next_cursor: z.string().optional()
    })
  })
  .extend({
    items: z.array(adminStuckWorkflowSchema)
  });

export type AdminDashboardSummary = z.infer<typeof adminDashboardSummarySchema>;
export type AdminStuckWorkflow = z.infer<typeof adminStuckWorkflowSchema>;
export type AdminStuckWorkflowsResponse = z.infer<
  typeof adminStuckWorkflowsResponseSchema
>;

/**
 * The list envelope used by `stuck-workflows` is a plain page (the backend
 * spreads `toPage` results rather than nesting them under `page`), so the
 * dedicated schema above is used instead of `cursorPageSchema`.
 */
export const adminDashboardPageSchema = z.object({
  from: z.string(),
  to: z.string(),
  scope: z.literal("created_in_window"),
  groups: adminDashboardGroupsSchema
});

/** `GET /api/v1/admin/dashboard/*` query filters (service line 16). */
export const adminDashboardQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

/** `GET /api/v1/admin/dashboard/stuck-workflows` query filters. */
export const adminStuckWorkflowsQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  category: z.string().trim().min(1).max(60).optional()
});

export { cursorPageSchema };
