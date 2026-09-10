import { createDefaultAuthRouteHandlers } from "@/features/auth/auth.route-handlers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ deviceId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { deviceId } = await context.params;
  return createDefaultAuthRouteHandlers().rotatePushToken(request, deviceId);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { deviceId } = await context.params;
  return createDefaultAuthRouteHandlers().revokePushToken(request, deviceId);
}
