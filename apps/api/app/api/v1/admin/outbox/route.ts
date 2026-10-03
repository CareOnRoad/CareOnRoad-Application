import { createDefaultAdminDeliveryRouteHandlers } from "@/features/admin/admin-delivery.route-handlers";

export async function GET(request: Request) {
  return createDefaultAdminDeliveryRouteHandlers().read(request, "outbox", "list");
}
