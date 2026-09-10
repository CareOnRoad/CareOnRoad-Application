import { createDefaultReviewRouteHandlers } from "@/features/reviews/review.route-handlers";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params;
  return createDefaultReviewRouteHandlers().createReview(request, assignmentId);
}
