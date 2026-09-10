import { createDefaultAssignmentRouteHandlers } from "@/features/assignments/assignment.route-handlers";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params;
  return createDefaultAssignmentRouteHandlers().recoverAssignment(request, assignmentId);
}
