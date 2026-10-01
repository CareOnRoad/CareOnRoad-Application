import { z } from "zod";
import { adminReasonValueSchema } from "@/features/admin/admin.schemas";

export const createPaymentOrderInputSchema = z.object({
  quote_id: z.string().uuid()
});

export const paymentOrderIdParamSchema = z.string().uuid();
export const resolvePaymentReviewInputSchema = z.object({
  action: z.enum(["confirm_received", "close_unpaid"]),
  reason: adminReasonValueSchema
}).strict();

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderInputSchema>;
