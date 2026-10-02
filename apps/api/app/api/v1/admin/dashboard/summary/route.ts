import { createDefaultAdminDashboardRouteHandlers } from "@/features/admin/admin-dashboard.route-handlers";
export async function GET(request: Request) {
  return createDefaultAdminDashboardRouteHandlers().read(request, "summary");
}
