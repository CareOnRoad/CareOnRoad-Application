import { createDefaultNotificationInboxRouteHandlers } from "@/features/notifications/notification-inbox.route-handlers";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultNotificationInboxRouteHandlers().markAllRead(request);
}
