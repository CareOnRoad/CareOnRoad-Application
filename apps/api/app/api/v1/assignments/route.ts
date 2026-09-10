import { createDefaultAssignmentRouteHandlers } from "@/features/assignments/assignment.route-handlers";

export async function GET(request: Request) {
  return createDefaultAssignmentRouteHandlers().listAssignments(request);
}
