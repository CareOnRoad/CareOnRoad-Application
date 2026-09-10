import { createDefaultAdminMechanicRouteHandlers } from "@/features/admin/admin-mechanic.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultAdminMechanicRouteHandlers().listMechanics(request);
}
