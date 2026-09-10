import { createDefaultPaymentRouteHandlers } from "@/features/payments/payment.route-handlers";

export const runtime = "nodejs";

type PaymentOrderRouteContext = {
  params: Promise<{ paymentOrderId: string }>;
};

export async function GET(request: Request, context: PaymentOrderRouteContext) {
  const { paymentOrderId } = await context.params;
  return createDefaultPaymentRouteHandlers().getPaymentOrder(request, paymentOrderId);
}
