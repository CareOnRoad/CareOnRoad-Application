import { createDefaultLiveTrackingCleanupRouteHandlers } from "@/features/live-tracking/live-tracking-cleanup.route-handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return createDefaultLiveTrackingCleanupRouteHandlers().run(request);
}
