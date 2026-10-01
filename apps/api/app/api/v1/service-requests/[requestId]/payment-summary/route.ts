import { createDefaultPaymentRouteHandlers } from "@/features/payments/payment.route-handlers";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await context.params;
  return createDefaultPaymentRouteHandlers().getPaymentSummary(request, requestId);
}
