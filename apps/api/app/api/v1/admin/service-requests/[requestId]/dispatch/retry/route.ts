import { createDefaultAdminDispatchRouteHandlers } from "@/features/admin/admin-dispatch.route-handlers";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  return createDefaultAdminDispatchRouteHandlers().command(request, (await context.params).requestId, "retry");
}
