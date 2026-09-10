import { createDefaultDispatchRouteHandlers } from "@/features/dispatch/dispatch.route-handlers";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { requestId } = await context.params;
  return createDefaultDispatchRouteHandlers().startDispatch(request, requestId);
}
