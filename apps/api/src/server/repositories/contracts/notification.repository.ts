import type { JsonObject } from "./idempotency.repository";

export type NotificationStatus = "pending" | "sent" | "failed";

export type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: JsonObject;
  dedupeKey: string;
  status: NotificationStatus;
  readAt?: Date;
  createdAt: Date;
  sentAt?: Date;
  lastErrorCode?: string;
};

export type CreateNotification = Pick<
  Notification,
  "id" | "userId" | "type" | "title" | "body" | "data" | "dedupeKey"
> &
  Partial<Pick<Notification, "status" | "readAt" | "createdAt" | "sentAt" | "lastErrorCode">>;

export type CreateNotificationResult = {
  notification: Notification;
  created: boolean;
};

export type NotificationCursor = { createdAt: Date; id: string };

export type NotificationPage = {
  items: Notification[];
  nextCursor?: NotificationCursor;
};

export type MarkNotificationReadResult = {
  notification: Notification;
  changed: boolean;
};

export interface NotificationRepository {
  createIfAbsent(input: CreateNotification): Promise<CreateNotificationResult>;
  findById(id: string): Promise<Notification | undefined>;
  findByDedupeKey(dedupeKey: string): Promise<Notification | undefined>;
  markSent(id: string, sentAt: Date): Promise<Notification>;
  markFailed(id: string, errorCode: string): Promise<Notification>;
  listOwned(input: {
    userId: string;
    unreadOnly: boolean;
    cursor?: NotificationCursor;
    limit: number;
  }): Promise<NotificationPage>;
  countUnread(userId: string): Promise<number>;
  markReadOwned(input: {
    id: string;
    userId: string;
    readAt: Date;
  }): Promise<MarkNotificationReadResult | undefined>;
  markAllReadOwned(input: {
    userId: string;
    cutoff: Date;
    readAt: Date;
  }): Promise<number>;
}
