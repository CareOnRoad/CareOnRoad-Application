import { createDefaultAdminUserRouteHandlers } from "@/features/admin/admin-user.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultAdminUserRouteHandlers().listUsers(request);
}
