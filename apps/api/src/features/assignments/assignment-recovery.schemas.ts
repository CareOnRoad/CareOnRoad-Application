import { z } from "zod";

export const assignmentRecoveryReasonSchema = z.enum([
  "cannot_continue",
  "no_show",
  "lost_contact"
]);

export const assignmentRecoveryInputSchema = z.object({
  reason_code: assignmentRecoveryReasonSchema
}).strict();

export type AssignmentRecoveryReason = z.infer<typeof assignmentRecoveryReasonSchema>;
