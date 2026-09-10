import { createDefaultAdminMechanicRouteHandlers } from "@/features/admin/admin-mechanic.route-handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ mechanicId: string }> };

export async function GET(request: Request, context: Context) {
  const { mechanicId } = await context.params;
  return createDefaultAdminMechanicRouteHandlers().getPerformance(
    request,
    mechanicId
  );
}
