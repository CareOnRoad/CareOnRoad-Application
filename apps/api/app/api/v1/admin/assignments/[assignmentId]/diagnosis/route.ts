import { createDefaultAdminSupervisionRouteHandlers } from "@/features/admin/admin-supervision.route-handlers";

export async function GET(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  return createDefaultAdminSupervisionRouteHandlers().read(request, (await context.params).assignmentId, "diagnosis");
}
