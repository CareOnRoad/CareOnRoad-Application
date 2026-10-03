import { createDefaultAdminDispatchRouteHandlers } from "@/features/admin/admin-dispatch.route-handlers";

export async function GET(request: Request, context: { params: Promise<{ roundId: string }> }) {
  return createDefaultAdminDispatchRouteHandlers().round(request, (await context.params).roundId);
}
