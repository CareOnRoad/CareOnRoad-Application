import { createDefaultNotificationInboxRouteHandlers } from "@/features/notifications/notification-inbox.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultNotificationInboxRouteHandlers().list(request);
}
