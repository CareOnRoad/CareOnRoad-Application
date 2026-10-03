import type { PushProvider } from "./device-delivery-credential.repository";

export const notificationDeliveryStatuses = [
  "pending",
  "sent",
  "invalid",
  "permanent_failed",
  "retryable_failed",
  "canceled"
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
  leaseToken?: string;
  leaseExpiresAt?: Date;
  nextAttemptAt?: Date;
};

export interface NotificationDeliveryRepository {
  listByNotificationIdForUpdate(id: string): Promise<NotificationDeliveryReceipt[]>;
  listPage(id: string, limit: number, cursor?: import("@/lib/list-pagination").PageCursor): Promise<NotificationDeliveryReceipt[]>;
  retryFailed(input: { ids: string[]; now: Date }): Promise<number>;
  cancelPending(input: { notificationId: string; now: Date }): Promise<number>;
  claim(input: { id: string; token: string; now: Date; leaseUntil: Date }): Promise<NotificationDeliveryReceipt | undefined>;
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
    leaseToken?: string;
    nextAttemptAt?: Date;
  }): Promise<NotificationDeliveryReceipt>;
}
