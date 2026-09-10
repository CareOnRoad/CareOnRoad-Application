import { createDefaultMechanicOperationsRouteHandlers } from "@/features/mechanic-operations/mechanic-operations.route-handlers";

export const runtime = "nodejs";

type AssignmentMediaRouteContext = {
  params: Promise<{ assignmentId: string }>;
};

export async function POST(request: Request, context: AssignmentMediaRouteContext) {
  const { assignmentId } = await context.params;
  return createDefaultMechanicOperationsRouteHandlers().addMedia(request, assignmentId);
}
