import { createDefaultMechanicOperationsRouteHandlers } from "@/features/mechanic-operations/mechanic-operations.route-handlers";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  return createDefaultMechanicOperationsRouteHandlers().getJob(request, (await context.params).assignmentId);
}
