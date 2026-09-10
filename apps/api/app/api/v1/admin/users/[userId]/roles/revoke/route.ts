import { createDefaultAdminUserRouteHandlers } from "@/features/admin/admin-user.route-handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ userId: string }> };

export async function POST(request: Request, context: Context) {
  const { userId } = await context.params;
  return createDefaultAdminUserRouteHandlers().revokeRole(request, userId);
}
