import { createDefaultMechanicOperationsRouteHandlers } from "@/features/mechanic-operations/mechanic-operations.route-handlers";

export const runtime = "nodejs";

type AssignmentEtaRouteContext = {
  params: Promise<{ assignmentId: string }>;
};

export async function POST(request: Request, context: AssignmentEtaRouteContext) {
  const { assignmentId } = await context.params;
  return createDefaultMechanicOperationsRouteHandlers().updateEta(request, assignmentId);
}
