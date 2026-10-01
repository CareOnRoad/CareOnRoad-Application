import { z } from "zod";

import { cursorPageSchema } from "./common";

/**
 * Response schemas for the read-only admin operational monitoring queues
 * `/api/v1/admin/operations/*` (Feature 011).
 *
 * IMPORTANT — these items are intentionally permissive.
 *
 * `toResponseItem` in
 * `apps/api/src/features/operations/operational-monitoring.service.ts:57-59`
 * generic-snake-cases whatever the repository returned; there is no
 * per-queue item schema in the backend. Pinning exact fields here would make
 * the frontend reject valid responses the moment the backend adds a column.
 *
 * The frontend must therefore treat each item as an opaque, already-redacted
 * record and render defensively. These queues are read-only and never expose
 * event payloads or raw worker errors.
 */

/** `OperationalQueue` (service line 8). */
export const operationalQueues = [
  "outbox-dead-letters",
  "payments-needs-review",
  "dispatch-stuck",
  "worker-runs"
] as const;

export type OperationalQueue = (typeof operationalQueues)[number];

/**
 * Values are `unknown` rather than a fixed shape. Common keys are
 * `id` and a timestamp, but neither is guaranteed per queue.
 */
export const operationalQueueItemSchema = z.record(z.unknown());

export const operationalQueueListResponseSchema = cursorPageSchema(
  operationalQueueItemSchema
);

export type OperationalQueueListResponse = z.infer<
  typeof operationalQueueListResponseSchema
>;

/** `OperationalMonitoringService` query schema (service lines 10-13). */
export const operationalQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional()
});
