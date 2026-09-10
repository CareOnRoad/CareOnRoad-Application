import { createDefaultReviewRebuildRouteHandlers } from "@/features/reviews/review.route-handlers";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultReviewRebuildRouteHandlers().rebuild(request);
}
