import { z } from "zod";
import { listQuerySchema, validDateRange } from "@/lib/list-pagination";

export const assignmentListSchema = listQuerySchema.extend({
  status: z.enum([
    "accepted", "en_route", "on_site", "diagnosis", "quoted", "awaiting_payment",
    "in_progress", "completed", "canceled", "recovery_canceled"
  ]).optional(),
  /**
   * Filter "chỉ các assignment đang active" (chưa tới trạng thái kết thúc).
   * Khi `true`, BE tự động loại trừ `completed`/`canceled`/`recovery_canceled`
   * nếu FE không truyền `status` cụ thể.
   * Mặc định `false` để giữ backward-compatible với các client chỉ filter theo status.
   */
  active_only: z.coerce.boolean().optional()
}).refine(validDateRange, "Invalid date range.");

/**
 * Set các status đã kết thúc (không còn active trong dispatch/list).
 * Dùng cho `active_only=true` để lọc chỉ các assignment đang chạy.
 */
export const TERMINAL_ASSIGNMENT_STATUSES = new Set<AssignmentStatusForFilter>([
  "completed",
  "canceled",
  "recovery_canceled"
]);

export type AssignmentStatusForFilter =
  | "accepted" | "en_route" | "on_site" | "diagnosis" | "quoted"
  | "awaiting_payment" | "in_progress" | "completed" | "canceled" | "recovery_canceled";

/**
 * Hỗ trợ filter active-only cho assignment list. Trả về:
 *  - Nếu caller truyền `status` cụ thể → giữ nguyên (ưu tiên caller).
 *  - Nếu `active_only=true` và không truyền `status` → inject 1 filter set
 *    để loại trừ terminal statuses.
 *  - Nếu cả hai đều không truyền → trả `undefined` (giữ nguyên behavior cũ).
 */
export function resolveAssignmentStatusFilter(
  input: { status?: AssignmentStatusForFilter; active_only?: boolean },
  availableStatuses: ReadonlyArray<AssignmentStatusForFilter> = [
    "accepted", "en_route", "on_site", "diagnosis", "quoted",
    "awaiting_payment", "in_progress", "completed", "canceled", "recovery_canceled"
  ]
): ReadonlyArray<AssignmentStatusForFilter> | undefined {
  if (input.status) return undefined; // caller đã chỉ định status cụ thể.
  if (input.active_only) {
    return availableStatuses.filter((s) => !TERMINAL_ASSIGNMENT_STATUSES.has(s));
  }
  return undefined;
}

export const assignmentStatusSchema = z.enum([
  "accepted",
  "en_route",
  "on_site",
  "diagnosis",
  "quoted",
  "awaiting_payment",
  "in_progress",
  "completed",
  "canceled"
]);

export const assignmentStatusInputSchema = z.object({
  status: assignmentStatusSchema,
  reason: z.string().trim().min(1).max(500).optional()
});

export type AssignmentStatusInput = z.infer<typeof assignmentStatusInputSchema>;
