import { createDefaultDispatchRouteHandlers } from "@/features/dispatch/dispatch.route-handlers";

export async function GET(request: Request) {
  return createDefaultDispatchRouteHandlers().listMyOffers(request);
}
