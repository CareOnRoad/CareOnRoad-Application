import { createFcmNotificationProvider } from "./fcm-notification-provider";
import type { NotificationProvider } from "./notification-provider";

export function createNotificationProvider(
  environment: Record<string, string | undefined> = process.env
): NotificationProvider {
  return createFcmNotificationProvider(environment);
}
