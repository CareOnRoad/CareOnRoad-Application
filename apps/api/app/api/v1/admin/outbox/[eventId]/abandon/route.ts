import { createDefaultAdminDeliveryRouteHandlers } from "@/features/admin/admin-delivery.route-handlers";

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  return createDefaultAdminDeliveryRouteHandlers().command(request, "outbox", (await context.params).eventId, "abandon");
}
