import type {
  CreateNotification,
  CreateNotificationResult,
  Notification,
  NotificationRepository
} from "../contracts/notification.repository";

export class InMemoryNotificationRepository implements NotificationRepository {
  constructor(private readonly notifications: Notification[]) {}

  async createIfAbsent(input: CreateNotification): Promise<CreateNotificationResult> {
    const existing = await this.findByDedupeKey(input.dedupeKey);
    if (existing) {
      return { notification: existing, created: false };
    }
    const notification: Notification = {
      ...input,
      status: input.status ?? "pending",
      createdAt: input.createdAt ?? new Date()
    };
    this.notifications.push(notification);
    return { notification, created: true };
  }

  async findById(id: string): Promise<Notification | undefined> {
    return this.notifications.find((notification) => notification.id === id);
  }

  async findByDedupeKey(dedupeKey: string): Promise<Notification | undefined> {
    return this.notifications.find((notification) => notification.dedupeKey === dedupeKey);
  }

  async markSent(id: string, sentAt: Date): Promise<Notification> {
    const notification = this.requireNotification(id);
    notification.status = "sent";
    notification.sentAt = sentAt;
    notification.lastErrorCode = undefined;
    return notification;
  }

  async markFailed(id: string, errorCode: string): Promise<Notification> {
    const notification = this.requireNotification(id);
    notification.status = "failed";
    notification.sentAt = undefined;
    notification.lastErrorCode = errorCode;
    return notification;
  }

  async listOwned(input: Parameters<NotificationRepository["listOwned"]>[0]) {
    const ordered = this.notifications
      .filter(
        (item) =>
          item.userId === input.userId &&
          (!input.unreadOnly || !item.readAt) &&
          (!input.cursor ||
            item.createdAt < input.cursor.createdAt ||
            (item.createdAt.getTime() === input.cursor.createdAt.getTime() &&
              item.id < input.cursor.id))
      )
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id)
      );
    const page = ordered.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page,
      ...(ordered.length > input.limit && last
        ? { nextCursor: { createdAt: last.createdAt, id: last.id } }
        : {})
    };
  }

  async countUnread(userId: string) {
    return this.notifications.filter((item) => item.userId === userId && !item.readAt).length;
  }

  async markReadOwned(input: Parameters<NotificationRepository["markReadOwned"]>[0]) {
    const notification = this.notifications.find(
      (item) => item.id === input.id && item.userId === input.userId
    );
    if (!notification) return undefined;
    const changed = !notification.readAt;
    notification.readAt ??= input.readAt;
    return { notification, changed };
  }

  async markAllReadOwned(input: Parameters<NotificationRepository["markAllReadOwned"]>[0]) {
    let count = 0;
    for (const notification of this.notifications) {
      if (
        notification.userId === input.userId &&
        !notification.readAt &&
        notification.createdAt <= input.cutoff
      ) {
        notification.readAt = input.readAt;
        count += 1;
      }
    }
    return count;
  }

  private requireNotification(id: string): Notification {
    const notification = this.notifications.find((item) => item.id === id);
    if (!notification) {
      throw new Error("NOTIFICATION_NOT_FOUND");
    }
    return notification;
  }
}
