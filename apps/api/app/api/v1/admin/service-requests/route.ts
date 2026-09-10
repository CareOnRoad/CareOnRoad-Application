import { createDefaultAdminServiceRequestRouteHandlers } from "@/features/admin/admin-service-request.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultAdminServiceRequestRouteHandlers().listRequests(request);
}
