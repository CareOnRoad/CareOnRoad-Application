import type { PushProvider } from "./device-delivery-credential.repository";

export const notificationDeliveryStatuses = [
  "pending",
  "sent",
  "invalid",
  "permanent_failed",
  "retryable_failed"
] as const;
export type NotificationDeliveryStatus = (typeof notificationDeliveryStatuses)[number];

export type NotificationDeliveryReceipt = {
  id: string;
  notificationId: string;
  credentialId: string;
  credentialVersion: number;
  provider: PushProvider;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  providerMessageId?: string;
  lastErrorCode?: string;
  lastAttemptedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export interface NotificationDeliveryRepository {
  createIfAbsent(input: {
    id: string;
    notificationId: string;
    credentialId: string;
    credentialVersion: number;
    provider: PushProvider;
    createdAt: Date;
  }): Promise<NotificationDeliveryReceipt>;
  listByNotificationId(notificationId: string): Promise<NotificationDeliveryReceipt[]>;
  recordOutcome(input: {
    id: string;
    status: Exclude<NotificationDeliveryStatus, "pending">;
    attemptedAt: Date;
    providerMessageId?: string;
    errorCode?: string;
  }): Promise<NotificationDeliveryReceipt>;
}
