import { createDefaultSubscriptionRouteHandlers } from "@/features/subscriptions/subscription.route-handlers";

export const runtime = "nodejs";

type SubscriptionOrderRouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function POST(request: Request, context: SubscriptionOrderRouteContext) {
  const { orderId } = await context.params;
  return createDefaultSubscriptionRouteHandlers().cancelSubscriptionOrder(request, orderId);
}
