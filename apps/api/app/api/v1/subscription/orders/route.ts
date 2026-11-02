import { createDefaultSubscriptionRouteHandlers } from "@/features/subscriptions/subscription.route-handlers";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultSubscriptionRouteHandlers().createSubscriptionOrder(request);
}
