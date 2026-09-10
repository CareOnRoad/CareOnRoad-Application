import { createDefaultServiceRequestRouteHandlers } from "@/features/service-requests/service-request.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultServiceRequestRouteHandlers().listServiceRequests(request);
}

export function POST(request: Request) {
  return createDefaultServiceRequestRouteHandlers().createServiceRequest(request);
}
