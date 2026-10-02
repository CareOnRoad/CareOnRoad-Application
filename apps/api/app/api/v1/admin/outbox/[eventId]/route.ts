import { createDefaultAdminDeliveryRouteHandlers } from "@/features/admin/admin-delivery.route-handlers";

export async function GET(request: Request, context: { params: Promise<{ eventId: string }> }) {
  return createDefaultAdminDeliveryRouteHandlers().read(request, "outbox", "detail", (await context.params).eventId);
}
