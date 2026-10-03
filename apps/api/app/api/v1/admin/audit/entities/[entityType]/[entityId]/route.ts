import { createDefaultAdminAuditRouteHandlers } from "@/features/admin/admin-audit.route-handlers";

export async function GET(request: Request, context: { params: Promise<{ entityType: string; entityId: string }> }) {
  return createDefaultAdminAuditRouteHandlers().read(request, "query", { entity_type: (await context.params).entityType, entity_id: (await context.params).entityId });
}
