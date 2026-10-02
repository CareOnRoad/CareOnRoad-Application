import { createDefaultAdminSupervisionRouteHandlers } from "@/features/admin/admin-supervision.route-handlers";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  return createDefaultAdminSupervisionRouteHandlers().command(request, (await context.params).requestId, "dispute");
}
