import { createDefaultLiveTrackingRouteHandlers } from "@/features/live-tracking/live-tracking.route-handlers";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params;
  return createDefaultLiveTrackingRouteHandlers().publish(request, assignmentId);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params;
  return createDefaultLiveTrackingRouteHandlers().getLatest(request, assignmentId);
}
