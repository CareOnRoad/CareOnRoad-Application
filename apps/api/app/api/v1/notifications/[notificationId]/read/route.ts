import { createDefaultNotificationInboxRouteHandlers } from "@/features/notifications/notification-inbox.route-handlers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ notificationId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { notificationId } = await context.params;
  return createDefaultNotificationInboxRouteHandlers().markRead(request, notificationId);
}
