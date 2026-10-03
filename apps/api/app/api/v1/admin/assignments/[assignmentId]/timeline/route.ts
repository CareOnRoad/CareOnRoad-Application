import { createDefaultAdminAssignmentRouteHandlers } from "@/features/admin/admin-assignment.route-handlers";

export async function GET(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  return createDefaultAdminAssignmentRouteHandlers().read(request, (await context.params).assignmentId, "timeline");
}
