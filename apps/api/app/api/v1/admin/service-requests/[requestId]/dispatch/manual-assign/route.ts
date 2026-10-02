import { createDefaultAdminAssignmentRouteHandlers } from "@/features/admin/admin-assignment.route-handlers";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  return createDefaultAdminAssignmentRouteHandlers().command(request, (await context.params).requestId, "manual_assign");
}
