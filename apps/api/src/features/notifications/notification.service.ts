import { randomUUID } from "node:crypto";

import { sanitizeAuditMetadata } from "@/features/audit/audit-sanitizer";
import type { AuditActorRole } from "@/server/repositories/contracts/audit.repository";
import type { JsonObject } from "@/server/repositories/contracts/idempotency.repository";
import type { Notification } from "@/server/repositories/contracts/notification.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: JsonObject;
  dedupeKey: string;
  actorId?: string;
  actorRole?: AuditActorRole;
  requestId?: string;
};

export type NotificationCreationResult = {
  notification: Notification;
  created: boolean;
};

export class NotificationService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: {
      now?: () => Date;
      createId?: () => string;
    } = {}
  ) {}

  createNotification(input: CreateNotificationInput): Promise<NotificationCreationResult> {
    validateInput(input);
    const now = this.options.now?.() ?? new Date();
    const createId = this.options.createId ?? randomUUID;

    return this.unitOfWork.execute(async ({ audit, notifications, outbox }) => {
      const result = await notifications.createIfAbsent({
        id: createId(),
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: sanitizeAuditMetadata(input.data ?? {}),
        dedupeKey: input.dedupeKey,
        createdAt: now
      });
      if (!result.created) {
        return result;
      }

      const payload = {
        resource_id: result.notification.id,
        actor_id: input.actorId ?? input.userId,
        event_type: input.type,
        status: "pending"
      };
      await outbox.append({
        id: createId(),
        topic: "notification.created",
        aggregateType: "notification",
        aggregateId: result.notification.id,
        dedupeKey: `notification.created:${input.dedupeKey}`,
        payload,
        createdAt: now,
        nextAttemptAt: now
      });
      await audit.append({
        id: createId(),
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: "notification.created",
        entityType: "notification",
        entityId: result.notification.id,
        requestId: input.requestId,
        metadata: payload,
        createdAt: now
      });
      return result;
    });
  }

  markSent(notificationId: string): Promise<Notification> {
    return this.updateDeliveryStatus(notificationId, "sent");
  }

  markFailed(notificationId: string, errorCode: string): Promise<Notification> {
    return this.updateDeliveryStatus(notificationId, "failed", normalizeErrorCode(errorCode));
  }

  private updateDeliveryStatus(
    notificationId: string,
    status: "sent" | "failed",
    errorCode?: string
  ): Promise<Notification> {
    const now = this.options.now?.() ?? new Date();
    const createId = this.options.createId ?? randomUUID;
    return this.unitOfWork.execute(async ({ audit, notifications }) => {
      const notification =
        status === "sent"
          ? await notifications.markSent(notificationId, now)
          : await notifications.markFailed(notificationId, errorCode ?? "DELIVERY_FAILED");
      await audit.append({
        id: createId(),
        action: `notification.${status}`,
        entityType: "notification",
        entityId: notificationId,
        metadata: {
          resource_id: notificationId,
          status,
          ...(errorCode ? { error_code: errorCode } : {})
        },
        createdAt: now
      });
      return notification;
    });
  }
}

function validateInput(input: CreateNotificationInput): void {
  if (!input.userId || !input.dedupeKey.trim()) {
    throw new Error("Notification user and dedupe key are required.");
  }
  if (!input.type.trim() || input.type.length > 100) {
    throw new Error("Notification type must contain 1 to 100 characters.");
  }
  if (!input.title.trim() || input.title.length > 200) {
    throw new Error("Notification title must contain 1 to 200 characters.");
  }
  if (!input.body.trim() || input.body.length > 2000) {
    throw new Error("Notification body must contain 1 to 2000 characters.");
  }
  if (input.dedupeKey.length > 300) {
    throw new Error("Notification dedupe key must not exceed 300 characters.");
  }
}

export function normalizeErrorCode(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .slice(0, 100);
  if (
    !normalized ||
    /(AUTH|KEY|SECRET|PASSWORD|CREDENTIAL|TOKEN|CARD|CVV|BANK|PAYMENT)/.test(normalized)
  ) {
    return "DELIVERY_FAILED";
  }
  return normalized;
}
