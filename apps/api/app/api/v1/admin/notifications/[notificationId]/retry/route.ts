import { createDefaultAdminDeliveryRouteHandlers } from "@/features/admin/admin-delivery.route-handlers";

export async function POST(request: Request, context: { params: Promise<{ notificationId: string }> }) {
  return createDefaultAdminDeliveryRouteHandlers().command(request, "notifications", (await context.params).notificationId, "retry");
}
