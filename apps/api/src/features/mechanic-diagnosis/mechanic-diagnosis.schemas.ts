import { z } from "zod";

export const mechanicDiagnosisInputSchema = z
  .object({
    diagnosis_text: z.string().trim().min(3).max(5000),
    recommended_work_text: z.string().trim().min(1).max(5000).optional(),
    safety_notes: z.string().trim().min(1).max(2000).optional()
  })
  .strict();

export type MechanicDiagnosisInput = z.infer<typeof mechanicDiagnosisInputSchema>;
