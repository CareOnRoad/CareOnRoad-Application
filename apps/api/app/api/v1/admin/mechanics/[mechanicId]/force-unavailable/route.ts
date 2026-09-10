import { createDefaultAdminMechanicRouteHandlers } from "@/features/admin/admin-mechanic.route-handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ mechanicId: string }> };

export async function POST(request: Request, context: Context) {
  const { mechanicId } = await context.params;
  return createDefaultAdminMechanicRouteHandlers().forceUnavailable(
    request,
    mechanicId
  );
}
