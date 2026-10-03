import { createDefaultAdminAssignmentRouteHandlers } from "@/features/admin/admin-assignment.route-handlers";

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  return createDefaultAdminAssignmentRouteHandlers().command(request, (await context.params).assignmentId, "note");
}
