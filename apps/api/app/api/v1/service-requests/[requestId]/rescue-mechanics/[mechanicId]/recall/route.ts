import { createDefaultDispatchRouteHandlers } from "@/features/dispatch/dispatch.route-handlers";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ requestId: string; mechanicId: string }> }) {
  const { requestId, mechanicId } = await context.params;
  return createDefaultDispatchRouteHandlers().recallRescueMechanic(request, requestId, mechanicId);
}
