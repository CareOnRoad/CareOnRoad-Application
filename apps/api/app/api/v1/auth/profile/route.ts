import { createDefaultAuthRouteHandlers } from "@/features/auth/auth.route-handlers";

export function PATCH(request: Request) {
  return createDefaultAuthRouteHandlers().updateProfile(request);
}

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultAuthRouteHandlers().bootstrapProfile(request);
}
