import { createDefaultAuthRouteHandlers } from "@/features/auth/auth.route-handlers";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultAuthRouteHandlers().bootstrapProfile(request);
}
