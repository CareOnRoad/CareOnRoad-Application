import { z } from "zod";

const monetaryAmountSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const quoteLineInputSchema = z
  .object({
    line_type: z.enum(["labor", "part", "other"]),
    description: z.string().trim().min(1).max(500),
    quantity: z
      .number()
      .positive()
      .max(99_999_999.99)
      .refine((value) => Number.isInteger(value * 100), {
        message: "Quantity supports at most two decimal places."
      }),
    unit_amount: monetaryAmountSchema
  })
  .strict();

export const quoteInputSchema = z
  .object({
    assignment_id: z.string().uuid(),
    diagnosis_id: z.string().uuid().optional(),
    discount_amount: monetaryAmountSchema.default(0),
    notes: z.string().trim().min(1).max(2000).optional(),
    expires_at: z.string().datetime({ offset: true }).optional(),
    purpose: z.enum(["standard", "rescue_labor", "rescue_final", "maintenance_labor", "maintenance_work"]).default("standard"),
    basis_quote_id: z.string().uuid().optional(),
    labor_pricing: z.object({
      base_amount: monetaryAmountSchema.refine((amount) => amount > 0),
      distance_amount: monetaryAmountSchema,
      weather_amount: monetaryAmountSchema,
      time_amount: monetaryAmountSchema,
      weather: z.enum(["sunny", "rain"])
    }).strict().optional(),
    lines: z.array(quoteLineInputSchema).max(100).default([])
  })
  .strict()
  .superRefine((input, context) => {
    if (input.purpose === "standard" && !input.lines.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Quote lines are required." });
    if ((input.purpose === "rescue_labor") !== Boolean(input.labor_pricing)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Labor pricing is required only for the rescue labor quote." });
    if (input.purpose !== "standard" && input.discount_amount !== 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "Agreed pricing cannot be discounted or changed." });
    if (input.purpose === "rescue_labor" && (input.lines.length || input.diagnosis_id)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Pre-travel labor quotes cannot contain parts or a field diagnosis." });
    if (input.purpose === "rescue_final" && input.lines.some((line) => line.line_type !== "part")) context.addIssue({ code: z.ZodIssueCode.custom, message: "Final rescue input accepts parts only; agreed labor is added by the server." });
    if (input.basis_quote_id && input.purpose !== "maintenance_work") context.addIssue({ code: z.ZodIssueCode.custom, message: "A basis quote applies only to maintenance additions." });
    if (input.purpose === "maintenance_labor" && (input.diagnosis_id || input.lines.some((line) => line.line_type === "part") || !input.lines.some((line) => line.line_type === "labor" && line.unit_amount > 0))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Maintenance labor requires positive labor lines, optional travel fees, and no parts or field diagnosis." });
    }
  });

export const approveQuoteInputSchema = z.object({
  payment_timing: z.enum(["labor_upfront", "after_repair"]).optional()
}).strict();

export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type QuoteLineInput = z.infer<typeof quoteLineInputSchema>;
