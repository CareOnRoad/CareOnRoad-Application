import { z } from "zod";

import { componentCodes } from "./component-taxonomy";

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const recommendedActionTypeSchema = z.enum([
  "emergency_rescue",
  "book_mobile_repair",
  "ask_followup",
  "safe_to_monitor"
]);

export const hypothesisSchema = z
  .object({
    rank: z.union([z.literal(1), z.literal(2)]),
    component_code: z.enum(componentCodes),
    cause: z.string().trim().min(1),
    symptoms: z.string().trim().min(1),
    consequences: z.string().trim().min(1),
    confidence: z.number().min(0).max(1),
    estimated_cost_min: z.number().min(0),
    estimated_cost_max: z.number().min(0)
  })
  .refine((value) => value.estimated_cost_min <= value.estimated_cost_max, {
    message: "estimated_cost_min must be less than or equal to estimated_cost_max",
    path: ["estimated_cost_min"]
  });

export const estimatedTotalSchema = z
  .object({
    currency: z.literal("VND"),
    min: z.number().min(0),
    max: z.number().min(0)
  })
  .refine((value) => value.min <= value.max, {
    message: "estimated_total.min must be less than or equal to estimated_total.max",
    path: ["min"]
  });

export const recommendedActionSchema = z.object({
  type: recommendedActionTypeSchema,
  label: z.string().trim().min(1)
});

export const diagnosisSchema = z
  .object({
    short_answer: z.string().trim().min(1).refine(hasAtMostThreeSentences, {
      message: "short_answer must contain at most 3 sentences"
    }),
    overall_confidence: z.number().min(0).max(1),
    risk_level: riskLevelSchema,
    can_continue_riding: z.boolean(),
    top_hypotheses: z.array(hypothesisSchema).max(2),
    estimated_total: estimatedTotalSchema,
    recommended_next_actions: z.array(recommendedActionSchema).max(2),
    followup_questions: z.array(z.string().trim().min(1)).max(2),
    transcribed_text: z.string().trim().min(1).optional(),
    fallback_used: z.boolean()
  })
  .strict();

export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type RecommendedActionType = z.infer<typeof recommendedActionTypeSchema>;
export type Hypothesis = z.infer<typeof hypothesisSchema>;
export type DiagnosisResult = z.infer<typeof diagnosisSchema>;

function hasAtMostThreeSentences(value: string): boolean {
  const sentences = value
    .split(/[.!?。！？]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.length <= 3;
}
