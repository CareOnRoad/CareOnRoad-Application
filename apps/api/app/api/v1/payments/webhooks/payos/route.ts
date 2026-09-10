import { createDefaultPaymentRouteHandlers } from "@/features/payments/payment.route-handlers";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultPaymentRouteHandlers().handlePayosWebhook(request);
}
