import { createDefaultOperationalMonitoringRouteHandlers } from "@/features/operations/operational-monitoring.route-handlers";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return createDefaultOperationalMonitoringRouteHandlers().list(request, "outbox-dead-letters");
}
