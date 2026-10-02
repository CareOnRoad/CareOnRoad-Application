import { createDefaultAdminDashboardRouteHandlers } from "@/features/admin/admin-dashboard.route-handlers";
export const runtime="nodejs";
export const GET=(request:Request)=>createDefaultAdminDashboardRouteHandlers().read(request,"service-requests");
