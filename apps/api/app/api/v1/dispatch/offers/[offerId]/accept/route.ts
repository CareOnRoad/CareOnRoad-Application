import { createDefaultAssignmentRouteHandlers } from "@/features/assignments/assignment.route-handlers";

export async function POST(
  request: Request,
  context: { params: Promise<{ offerId: string }> }
) {
  const { offerId } = await context.params;
  return createDefaultAssignmentRouteHandlers().acceptOffer(request, offerId);
}
