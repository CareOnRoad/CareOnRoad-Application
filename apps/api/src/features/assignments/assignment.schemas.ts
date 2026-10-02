import { z } from "zod";
import { listQuerySchema, validDateRange } from "@/lib/list-pagination";

export const assignmentListSchema = listQuerySchema.extend({ status: z.enum([
  "accepted", "en_route", "on_site", "diagnosis", "quoted", "awaiting_payment",
  "in_progress", "completed", "canceled", "recovery_canceled"
]).optional() }).refine(validDateRange, "Invalid date range.");

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
