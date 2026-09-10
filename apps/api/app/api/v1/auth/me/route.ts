import { createDefaultAuthRouteHandlers } from "@/features/auth/auth.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultAuthRouteHandlers().getMe(request);
}
