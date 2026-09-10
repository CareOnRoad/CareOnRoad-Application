import { createDefaultAdminServiceRequestRouteHandlers } from "@/features/admin/admin-service-request.route-handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ requestId: string }> };

export async function POST(request: Request, context: Context) {
  const { requestId } = await context.params;
  return createDefaultAdminServiceRequestRouteHandlers().cancel(
    request,
    requestId
  );
}
