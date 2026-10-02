import { createDefaultAdminServiceRequestRouteHandlers } from "@/features/admin/admin-service-request.route-handlers";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  return createDefaultAdminServiceRequestRouteHandlers().repairReservation(request, (await context.params).requestId);
}
