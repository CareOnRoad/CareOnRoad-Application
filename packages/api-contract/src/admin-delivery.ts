import { z } from "zod";

import { cursorPageSchema, adminReasonValueSchema } from "./common";

/**
 * Response schemas for `/api/v1/admin/notifications/**` and
 * `/api/v1/admin/outbox/**`.
 *
 * Shapes mirror `AdminDeliveryService` in
 * `apps/api/src/features/admin/admin-delivery.service.ts`
 * (`safeNotification` line 141, `safeOutbox` line 138).
 *
 * IMPORTANT — `next_action_codes` on an outbox event is the backend's own
 * decision about whether `retry` / `abandon` are legal right now (the service
 * refuses both while a worker lease is active, and refuses `retry` for
 * topics that are not safe to replay). The frontend MUST render those
 * buttons from `next_action_codes` only.
 */

export const adminNotificationStatuses = [
  "pending",
  "sent",
  "failed",
  "canceled",
  "processing"
] as const;

export const adminOutboxStatuses = [
  "pending",
  "processing",
  "processed",
  "dead_letter",
  "abandoned"
] as const;

/** `safeNotification` (service line 141). */
export const adminNotificationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  type: z.string(),
  status: z.string(),
  is_read: z.boolean(),
  created_at: z.string(),
  sent_at: z.string().optional(),
  canceled_at: z.string().optional(),
  admin_retry_count: z.number().int().nonnegative(),
  error_code: z.string().optional()
});

/** The notification detail view adds its device delivery receipts. */
export const adminNotificationDeliveryReceiptSchema = z.object({
  id: z.string(),
  status: z.string(),
  provider: z.string(),
  attempt_count: z.number().int().nonnegative(),
  active_lease: z.boolean(),
  error_code: z.string().optional(),
  created_at: z.string(),
  completed_at: z.string().optional(),
  next_attempt_at: z.string().optional()
});

export const adminNotificationDetailSchema = adminNotificationSchema.extend({
  delivery_receipts: cursorPageSchema(adminNotificationDeliveryReceiptSchema)
});

/** `safeOutbox` (service line 138). */
export const adminOutboxEventSchema = z.object({
  id: z.string(),
  topic: z.string(),
  aggregate_type: z.string(),
  aggregate_id: z.string(),
  status: z.string(),
  attempt_count: z.number().int().nonnegative(),
  admin_retry_count: z.number().int().nonnegative(),
  active_lease: z.boolean(),
  next_attempt_at: z.string(),
  created_at: z.string(),
  processed_at: z.string().optional(),
  abandoned_at: z.string().optional(),
  error_code: z.string().optional(),
  next_action_codes: z.array(z.string())
});

export const adminNotificationListResponseSchema = cursorPageSchema(
  adminNotificationSchema
);
export const adminOutboxListResponseSchema = cursorPageSchema(adminOutboxEventSchema);

/** `GET /api/v1/admin/notifications/delivery-summary` (service line 32). */
export const adminNotificationDeliverySummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  counts: z.record(z.string(), z.number().int().nonnegative())
});

/**
 * `GET /api/v1/admin/outbox/worker-health` (service lines 36-38) reuses the
 * operational worker-run shape.
 */
export const adminWorkerRunSchema = z.object({
  id: z.string(),
  worker_name: z.string(),
  status: z.string(),
  items_claimed: z.number().int().nonnegative(),
  items_succeeded: z.number().int().nonnegative(),
  items_failed: z.number().int().nonnegative(),
  error_code: z.string().optional(),
  started_at: z.string(),
  completed_at: z.string()
});

export const adminWorkerHealthResponseSchema = z.object({
  source: z.string(),
  items: z.array(adminWorkerRunSchema),
  page: z.object({
    limit: z.number().int().positive(),
    has_more: z.boolean(),
    next_cursor: z.string().optional()
  })
});

export type AdminNotification = z.infer<typeof adminNotificationSchema>;
export type AdminNotificationDetail = z.infer<typeof adminNotificationDetailSchema>;
export type AdminOutboxEvent = z.infer<typeof adminOutboxEventSchema>;
export type AdminWorkerRun = z.infer<typeof adminWorkerRunSchema>;

/**
 * Query for the notification and outbox lists. The backend accepts a shared
 * set of filters (`admin-delivery.service.ts` query schemas): `limit`,
 * `cursor`, `status`, `topic`, `type`, `user_id`, `from`, `to`.
 */
export const adminDeliveryListQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  topic: z.string().trim().min(1).max(200).optional(),
  type: z.string().trim().min(1).max(80).optional(),
  user_id: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

/** `GET /api/v1/admin/notifications/delivery-summary` query (dates only). */
export const adminDeliverySummaryQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

/**
 * Body for `POST .../notifications/{cancel,retry}` and
 * `POST .../outbox/{retry,abandon}`.
 */
export const adminDeliveryCommandSchema = z
  .object({ reason: adminReasonValueSchema })
  .strict();
