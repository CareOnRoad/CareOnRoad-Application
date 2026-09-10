import { createDefaultAdminUserRouteHandlers } from "@/features/admin/admin-user.route-handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ deviceId: string }> };

export async function POST(request: Request, context: Context) {
  const { deviceId } = await context.params;
  return createDefaultAdminUserRouteHandlers().revokeDevice(request, deviceId);
}
