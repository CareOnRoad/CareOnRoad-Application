import { createDefaultAdminDispatchRouteHandlers } from "@/features/admin/admin-dispatch.route-handlers";

export async function GET(request: Request, context: { params: Promise<{ requestId: string }> }) {
  return createDefaultAdminDispatchRouteHandlers().read(request, (await context.params).requestId, "eligible");
}
