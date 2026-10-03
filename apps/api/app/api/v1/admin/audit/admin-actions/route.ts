import { createDefaultAdminAuditRouteHandlers } from "@/features/admin/admin-audit.route-handlers";

export async function GET(request: Request) {
  return createDefaultAdminAuditRouteHandlers().read(request, "admin_actions");
}
