import { createDefaultAdminDeliveryRouteHandlers } from "@/features/admin/admin-delivery.route-handlers";

export async function GET(request: Request, context: { params: Promise<{ notificationId: string }> }) {
  return createDefaultAdminDeliveryRouteHandlers().read(request, "notifications", "detail", (await context.params).notificationId);
}
