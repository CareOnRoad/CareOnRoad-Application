import { createDefaultDispatchRouteHandlers } from "@/features/dispatch/dispatch.route-handlers";

type RouteContext = {
  params: Promise<{ offerId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { offerId } = await context.params;
  return createDefaultDispatchRouteHandlers().declineOffer(request, offerId);
}
