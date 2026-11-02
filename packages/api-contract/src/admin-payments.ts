import { z } from "zod";

import { adminReasonValueSchema } from "./common";

/**
 * Response and request schemas for
 * `POST /api/v1/admin/payments/orders/[paymentOrderId]/resolve`.
 *
 * Shapes mirror `PaymentService.resolvePaymentReview` in
 * `apps/api/src/features/payments/payment.service.ts` (line 388) and
 * `resolvePaymentReviewInputSchema` in `payment.schemas.ts` (line 9).
 *
 * IMPORTANT — this command is the only administrative action that talks to
 * the real payment provider: the service calls `getPaymentStatus` against
 * payOS before deciding (service line 407) and then confirms or closes a
 * real money order. The frontend MUST require an explicit two-step
 * confirmation for it.
 *
 * The response body is provider-specific and is intentionally permissive.
 */

export const adminPaymentReviewActions = [
  "confirm_received",
  "close_unpaid"
] as const;

export type AdminPaymentReviewAction = (typeof adminPaymentReviewActions)[number];

/**
 * Body of the payment review resolution. `action` is required in addition to
 * `reason` — this is NOT a plain reason-only command.
 */
export const adminPaymentReviewResolveSchema = z
  .object({
    action: z.enum(adminPaymentReviewActions),
    reason: adminReasonValueSchema
  })
  .strict();

export type AdminPaymentReviewResolveInput = z.infer<
  typeof adminPaymentReviewResolveSchema
>;

/**
 * The resolution response is provider-derived. It is intentionally permissive
 * so a provider field addition never breaks the admin UI.
 */
export const adminPaymentReviewResolveResponseSchema = z.record(z.unknown());

export type AdminPaymentReviewResolveResponse = z.infer<
  typeof adminPaymentReviewResolveResponseSchema
>;
