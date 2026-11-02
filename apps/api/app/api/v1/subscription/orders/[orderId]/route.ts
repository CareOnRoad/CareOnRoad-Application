import { createDefaultSubscriptionRouteHandlers } from "@/features/subscriptions/subscription.route-handlers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  return createDefaultSubscriptionRouteHandlers().getSubscriptionOrder(request, orderId);
}
