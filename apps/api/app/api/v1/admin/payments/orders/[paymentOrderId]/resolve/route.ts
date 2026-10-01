import { createDefaultPaymentRouteHandlers } from "@/features/payments/payment.route-handlers";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ paymentOrderId: string }> }) {
  const { paymentOrderId } = await context.params;
  return createDefaultPaymentRouteHandlers().resolvePaymentReview(request, paymentOrderId);
}
