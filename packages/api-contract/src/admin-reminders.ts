import { z } from "zod";

import { cursorPageSchema, adminReasonValueSchema } from "./common";

/**
 * Response schemas for `/api/v1/admin/reminders/**` and
 * `POST /api/v1/admin/reminder-occurrences/[occurrenceId]/retry`.
 *
 * Shapes mirror `AdminReminderService` in
 * `apps/api/src/features/admin/admin-reminder.service.ts`
 * (`safeRule` line 92, `safeOccurrence` line 93).
 */

export const adminReminderOccurrenceStatuses = [
  "pending",
  "processed",
  "failed",
  "skipped"
] as const;

/** `safeRule` (service line 92). */
export const adminReminderRuleSchema = z.object({
  id: z.string(),
  rider_id: z.string(),
  motorcycle_id: z.string(),
  enabled: z.boolean(),
  interval_days: z.number().int(),
  next_due_at: z.string(),
  failure_count: z.number().int().nonnegative(),
  active_lease: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

/** `safeOccurrence` (service line 93). */
export const adminReminderOccurrenceSchema = z.object({
  id: z.string(),
  rule_id: z.string(),
  status: z.string(),
  notification_id: z.string().nullish(),
  retry_count: z.number().int().nonnegative(),
  due_at: z.string(),
  created_at: z.string(),
  processed_at: z.string().optional()
});

/** The reminder worker health view (service lines 29-32). */
export const adminReminderWorkerRunSchema = z.object({
  id: z.string(),
  status: z.string(),
  items_claimed: z.number().int().nonnegative(),
  items_succeeded: z.number().int().nonnegative(),
  items_failed: z.number().int().nonnegative(),
  completed_at: z.string()
});

export const adminReminderListResponseSchema = cursorPageSchema(
  adminReminderRuleSchema
);
export const adminReminderOccurrenceListResponseSchema = cursorPageSchema(
  adminReminderOccurrenceSchema
);
export const adminReminderHealthResponseSchema = z.object({
  items: z.array(adminReminderWorkerRunSchema),
  page: z.object({
    limit: z.number().int().positive(),
    has_more: z.boolean(),
    next_cursor: z.string().optional()
  })
});

export type AdminReminderRule = z.infer<typeof adminReminderRuleSchema>;
export type AdminReminderOccurrence = z.infer<typeof adminReminderOccurrenceSchema>;

/**
 * Query for the reminder rule list. The backend also accepts `rider_id` and
 * the shared date window.
 */
export const adminReminderListQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  rider_id: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

/** Query for the occurrence list of one rule. */
export const adminReminderOccurrenceQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

/** `POST /api/v1/admin/reminders/[reminderId]/disable` body. */
export const adminReminderDisableSchema = z
  .object({ reason: adminReasonValueSchema })
  .strict();

/**
 * `POST /api/v1/admin/reminders/[reminderId]/enable` body. `next_due_at` must
 * be in the future — the backend rejects it otherwise
 * (`admin-reminder.service.ts:44`).
 */
export const adminReminderEnableSchema = z
  .object({
    reason: adminReasonValueSchema,
    next_due_at: z.string().datetime({ offset: true })
  })
  .strict();

/**
 * `POST /api/v1/admin/reminder-occurrences/[occurrenceId]/retry` body.
 */
export const adminReminderRetrySchema = z
  .object({ reason: adminReasonValueSchema })
  .strict();
