import { createDefaultAdminAuditRouteHandlers } from "@/features/admin/admin-audit.route-handlers";

export async function GET(request: Request, context: { params: Promise<{ actorId: string }> }) {
  return createDefaultAdminAuditRouteHandlers().read(request, "query", { actor_id: (await context.params).actorId });
}
