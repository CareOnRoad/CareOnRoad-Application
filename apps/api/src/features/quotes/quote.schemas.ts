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
    lines: z.array(quoteLineInputSchema).min(1).max(100)
  })
  .strict();

export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type QuoteLineInput = z.infer<typeof quoteLineInputSchema>;
