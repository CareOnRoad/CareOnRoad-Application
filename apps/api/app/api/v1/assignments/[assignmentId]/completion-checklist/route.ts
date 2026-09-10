import { createDefaultMechanicOperationsRouteHandlers } from "@/features/mechanic-operations/mechanic-operations.route-handlers";

export const runtime = "nodejs";

type AssignmentCompletionChecklistRouteContext = {
  params: Promise<{ assignmentId: string }>;
};

export async function POST(
  request: Request,
  context: AssignmentCompletionChecklistRouteContext
) {
  const { assignmentId } = await context.params;
  return createDefaultMechanicOperationsRouteHandlers().submitCompletionChecklist(
    request,
    assignmentId
  );
}
