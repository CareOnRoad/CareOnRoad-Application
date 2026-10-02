import { createDefaultAdminSupervisionRouteHandlers } from "@/features/admin/admin-supervision.route-handlers";

export async function GET(request: Request, context: { params: Promise<{ requestId: string }> }) {
  return createDefaultAdminSupervisionRouteHandlers().read(request, (await context.params).requestId, "quotes");
}
