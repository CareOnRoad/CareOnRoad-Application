import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import { sanitizeNotificationData } from "./notification-data";
import {
  loadActiveActor,
  primaryAuditRole
} from "@/features/assignments/assignment.service";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type {
  Notification,
  NotificationCursor
} from "@/server/repositories/contracts/notification.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import {
  notificationIdSchema,
  notificationInboxQuerySchema
} from "./notification-inbox.schemas";

export type InboxNotificationResponse = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: "pending" | "sent" | "failed" | "canceled";
  read_at?: string;
  created_at: string;
  sent_at?: string;
};

export class NotificationInboxService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  list(identity: VerifiedSupabaseIdentity, input: unknown) {
    const parsed = notificationInboxQuerySchema.safeParse(input);
    if (!parsed.success) throw invalidInput("Notification inbox filters are invalid.");
    const cursor = parsed.data.cursor ? decodeCursor(parsed.data.cursor) : undefined;
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const page = await repositories.notifications.listOwned({
        userId: actor.id,
        unreadOnly: parsed.data.unread_only,
        limit: parsed.data.limit,
        ...(cursor ? { cursor } : {})
      });
      return {
        items: page.items.map(toInboxResponse),
        page: {
          limit: parsed.data.limit,
          has_more: Boolean(page.nextCursor),
          ...(page.nextCursor ? { next_cursor: encodeCursor(page.nextCursor) } : {})
        }
      };
    });
  }

  unreadCount(identity: VerifiedSupabaseIdentity) {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      return { unread_count: await repositories.notifications.countUnread(actor.id) };
    });
  }

  markRead(identity: VerifiedSupabaseIdentity, notificationId: string) {
    const parsedId = notificationIdSchema.safeParse(notificationId);
    if (!parsedId.success) throw invalidInput("Notification ID is invalid.");
    const now = this.options.now?.() ?? new Date();
    const createId = this.options.createId ?? randomUUID;
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const result = await repositories.notifications.markReadOwned({
        id: parsedId.data,
        userId: actor.id,
        readAt: now
      });
      if (!result) throw new NotificationInboxError("NOT_FOUND", "Notification not found.", 404);
      if (result.changed) {
        await repositories.audit.append({
          id: createId(),
          actorId: actor.id,
          actorRole: primaryAuditRole(actor.roles),
          action: "notification.read",
          entityType: "notification",
          entityId: result.notification.id,
          metadata: { resource_id: result.notification.id, status: "read" },
          createdAt: now
        });
      }
      return toInboxResponse(result.notification);
    });
  }

  markAllRead(identity: VerifiedSupabaseIdentity) {
    const now = this.options.now?.() ?? new Date();
    const createId = this.options.createId ?? randomUUID;
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveActor(repositories, identity.subject);
      const count = await repositories.notifications.markAllReadOwned({
        userId: actor.id,
        cutoff: now,
        readAt: now
      });
      if (count > 0) {
        await repositories.audit.append({
          id: createId(),
          actorId: actor.id,
          actorRole: primaryAuditRole(actor.roles),
          action: "notification.read_all",
          entityType: "notification_inbox",
          entityId: actor.id,
          metadata: { user_id: actor.id, status: "read", change: count },
          createdAt: now
        });
      }
      return { marked_read: count, read_at: now.toISOString() };
    });
  }
}

function toInboxResponse(notification: Notification): InboxNotificationResponse {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: sanitizeNotificationData(notification.data),
    status: notification.status,
    ...(notification.readAt ? { read_at: notification.readAt.toISOString() } : {}),
    created_at: notification.createdAt.toISOString(),
    ...(notification.sentAt ? { sent_at: notification.sentAt.toISOString() } : {})
  };
}

function encodeCursor(cursor: NotificationCursor) {
  return Buffer.from(
    JSON.stringify({ created_at: cursor.createdAt.toISOString(), id: cursor.id })
  ).toString("base64url");
}

function decodeCursor(value: string): NotificationCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      created_at?: unknown;
      id?: unknown;
    };
    const createdAt = typeof parsed.created_at === "string" ? new Date(parsed.created_at) : undefined;
    const id = notificationIdSchema.safeParse(parsed.id);
    if (!createdAt || Number.isNaN(createdAt.getTime()) || !id.success) throw new Error();
    return { createdAt, id: id.data };
  } catch {
    throw invalidInput("Notification inbox cursor is invalid.");
  }
}

function invalidInput(message: string) {
  return new NotificationInboxError("INVALID_INPUT", message, 400);
}

export class NotificationInboxError extends Error {
  constructor(
    public readonly errorCode: Extract<ApiErrorCode, "INVALID_INPUT" | "NOT_FOUND">,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "NotificationInboxError";
  }
}
