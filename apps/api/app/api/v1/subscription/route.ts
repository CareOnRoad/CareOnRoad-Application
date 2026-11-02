import { createDefaultSubscriptionRouteHandlers } from "@/features/subscriptions/subscription.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultSubscriptionRouteHandlers().getMySubscription(request);
}
