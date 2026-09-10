import { z } from "zod";

export const createPaymentOrderInputSchema = z.object({
  quote_id: z.string().uuid()
});

export const paymentOrderIdParamSchema = z.string().uuid();

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderInputSchema>;
