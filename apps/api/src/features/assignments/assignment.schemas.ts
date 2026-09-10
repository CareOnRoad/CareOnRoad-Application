import { z } from "zod";

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
