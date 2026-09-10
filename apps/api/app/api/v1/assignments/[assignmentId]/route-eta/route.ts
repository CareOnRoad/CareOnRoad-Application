import { createDefaultRouteEtaRouteHandlers } from "@/features/route-eta/route-eta.route-handlers";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params;
  return createDefaultRouteEtaRouteHandlers().getRouteEta(request, assignmentId);
}
