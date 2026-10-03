import { createDefaultAdminSupervisionRouteHandlers } from "@/features/admin/admin-supervision.route-handlers";

export async function GET(request: Request, context: { params: Promise<{ quoteId: string }> }) {
  return createDefaultAdminSupervisionRouteHandlers().read(request, (await context.params).quoteId, "quote");
}
