import { createDefaultAssignmentRouteHandlers } from "@/features/assignments/assignment.route-handlers";

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params;
  return createDefaultAssignmentRouteHandlers().transitionAssignment(request, assignmentId);
}
