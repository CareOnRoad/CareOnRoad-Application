import { z } from "zod";
import type { JsonObject } from "@/server/repositories/contracts/idempotency.repository";

const navigationData = z.object({
  status: z.enum(["due", "queued", "sent", "pending", "failed", "offered", "accepted", "approved", "rejected", "completed", "canceled", "manual_escalation"]).optional(),
  resource_id: z.string().uuid().optional(),
  request_id: z.string().uuid().optional(),
  assignment_id: z.string().uuid().optional(),
  quote_id: z.string().uuid().optional(),
  candidate_id: z.string().uuid().optional(),
  reminder_id: z.string().uuid().optional(),
  reminder_context_id: z.string().uuid().optional(),
  motorcycle_id: z.string().uuid().optional(),
  payment_order_id: z.string().uuid().optional(),
  notification_id: z.string().uuid().optional(),
  version: z.number().int().positive().optional(),
  due_at: z.string().datetime({ offset: true }).optional(),
  scheduled_start_at: z.string().datetime({ offset: true }).optional()
});

export function sanitizeNotificationData(data: Record<string, unknown>): JsonObject {
  // Validate fields independently so one obsolete value cannot hide valid navigation IDs.
  return Object.fromEntries(Object.entries(navigationData.shape).flatMap(([key, schema]) => {
    const result = schema.safeParse(data[key]);
    return result.success && result.data !== undefined ? [[key, result.data]] : [];
  })) as JsonObject;
}
