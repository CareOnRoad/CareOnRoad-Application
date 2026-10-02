import { sanitizeAdminReason } from "@/features/admin/admin-redaction";
import type { TransactionSql } from "postgres";

import type { JsonObject } from "../contracts/idempotency.repository";
import type {
  CreateNotification,
  CreateNotificationResult,
  Notification,
  NotificationRepository,
  NotificationStatus
} from "../contracts/notification.repository";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: JsonObject;
  dedupe_key: string;
  status: NotificationStatus;
  read_at: Date | null;
  created_at: Date;
  sent_at: Date | null;
  last_error_code: string | null;
  admin_retry_count: number;
  canceled_at: Date | null;
};

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly sql: TransactionSql) {}

  async findByIdForUpdate(id: string): Promise<Notification | undefined> {
    const [row] = await this.sql<NotificationRow[]>`select * from notifications where id = ${id} for update`;
    return row ? mapNotificationRow(row) : undefined;
  }
  async listAdmin(input: Parameters<NotificationRepository["listAdmin"]>[0]) {
    const rows = await this.sql<NotificationRow[]>`select * from notifications where
      (${input.status ?? null}::text is null or status::text = ${input.status ?? null})
      and (${input.userId ?? null}::uuid is null or user_id = ${input.userId ?? null}::uuid)
      and (${input.date_from ?? null}::timestamptz is null or created_at >= ${input.date_from ?? null}::timestamptz)
      and (${input.date_to ?? null}::timestamptz is null or created_at <= ${input.date_to ?? null}::timestamptz)
      and (${input.cursor?.timestamp ?? null}::timestamptz is null or (date_trunc('milliseconds', created_at), id) < (${input.cursor?.timestamp ?? null}::timestamptz, ${input.cursor?.id ?? null}::uuid))
      order by date_trunc('milliseconds', created_at) desc, id desc limit ${input.limit + 1}`;
    return rows.map(mapNotificationRow);
  }
  async summary(input: { from: Date; to: Date }) {
    return this.sql<{ status: NotificationStatus; count: number }[]>`select status, count(*)::integer as count from notifications
      where created_at between ${input.from} and ${input.to} group by status order by status`;
  }
  async recoverDelivery(input: Parameters<NotificationRepository["recoverDelivery"]>[0]) {
    const [row] = await this.sql<NotificationRow[]>`update notifications set status = ${input.status}, sent_at = null, last_error_code = null,
      admin_retry_count = admin_retry_count + ${input.status === "pending" ? 1 : 0}, recovery_admin_id = ${input.actorId},
      recovery_reason = ${sanitizeAdminReason(input.reason)}, recovery_at = ${input.now}, canceled_at = ${input.status === "canceled" ? input.now : null}
      where id = ${input.id} and status in ('pending', 'failed') and (${input.status === "canceled"} or admin_retry_count < 3) returning *`;
    return row ? mapNotificationRow(row) : undefined;
  }

  async createIfAbsent(input: CreateNotification): Promise<CreateNotificationResult> {
    const rows = await this.sql<NotificationRow[]>`
      insert into notifications (
        id, user_id, type, title, body, data, dedupe_key, status, read_at,
        created_at, sent_at, last_error_code
      ) values (
        ${input.id}, ${input.userId}, ${input.type}, ${input.title}, ${input.body},
        ${this.sql.json(input.data as Parameters<TransactionSql["json"]>[0])},
        ${input.dedupeKey}, ${input.status ?? "pending"}, ${input.readAt ?? null},
        ${input.createdAt ?? new Date()}, ${input.sentAt ?? null},
        ${input.lastErrorCode ?? null}
      )
      on conflict (dedupe_key) do nothing
      returning *
    `;
    if (rows[0]) {
      return { notification: mapNotificationRow(rows[0]), created: true };
    }
    const existing = await this.findByDedupeKey(input.dedupeKey);
    if (!existing) {
      throw new Error("NOTIFICATION_DEDUPE_LOOKUP_FAILED");
    }
    return { notification: existing, created: false };
  }

  async findById(id: string): Promise<Notification | undefined> {
    const rows = await this.sql<NotificationRow[]>`
      select * from notifications where id = ${id} limit 1
    `;
    return rows[0] ? mapNotificationRow(rows[0]) : undefined;
  }

  async findByDedupeKey(dedupeKey: string): Promise<Notification | undefined> {
    const rows = await this.sql<NotificationRow[]>`
      select * from notifications where dedupe_key = ${dedupeKey} limit 1
    `;
    return rows[0] ? mapNotificationRow(rows[0]) : undefined;
  }

  async markSent(id: string, sentAt: Date): Promise<Notification> {
    const rows = await this.sql<NotificationRow[]>`
      update notifications
      set status = 'sent', sent_at = ${sentAt}, last_error_code = null
      where id = ${id} and status::text <> 'canceled'
      returning *
    `;
    if (!rows[0]) { const existing = await this.findById(id); if (existing?.status === "canceled") return existing; throw new Error("NOTIFICATION_NOT_FOUND"); }
    return mapNotificationRow(rows[0]);
  }

  async markFailed(id: string, errorCode: string): Promise<Notification> {
    const rows = await this.sql<NotificationRow[]>`
      update notifications
      set status = 'failed', sent_at = null, last_error_code = ${errorCode}
      where id = ${id} and status::text <> 'canceled'
      returning *
    `;
    if (!rows[0]) { const existing = await this.findById(id); if (existing?.status === "canceled") return existing; throw new Error("NOTIFICATION_NOT_FOUND"); }
    return mapNotificationRow(rows[0]);
  }

  async listOwned(input: Parameters<NotificationRepository["listOwned"]>[0]) {
    const rows = await this.sql<NotificationRow[]>`
      select * from notifications
      where user_id = ${input.userId}
        and (${input.unreadOnly} = false or read_at is null)
        and (
          ${input.cursor?.createdAt ?? null}::timestamptz is null
          or (created_at, id) < (
            ${input.cursor?.createdAt ?? null},
            ${input.cursor?.id ?? null}::uuid
          )
        )
      order by created_at desc, id desc
      limit ${input.limit + 1}
    `;
    const hasMore = rows.length > input.limit;
    const items = rows.slice(0, input.limit).map(mapNotificationRow);
    const last = items.at(-1);
    return {
      items,
      ...(hasMore && last
        ? { nextCursor: { createdAt: last.createdAt, id: last.id } }
        : {})
    };
  }

  async countUnread(userId: string) {
    const rows = await this.sql<{ count: number }[]>`
      select count(*)::integer as count from notifications
      where user_id = ${userId} and read_at is null
    `;
    return rows[0]?.count ?? 0;
  }

  async markReadOwned(input: Parameters<NotificationRepository["markReadOwned"]>[0]) {
    const rows = await this.sql<NotificationRow[]>`
      update notifications
      set read_at = ${input.readAt}
      where id = ${input.id} and user_id = ${input.userId} and read_at is null
      returning *
    `;
    if (rows[0]) return { notification: mapNotificationRow(rows[0]), changed: true };
    const existing = await this.sql<NotificationRow[]>`
      select * from notifications where id = ${input.id} and user_id = ${input.userId}
      limit 1
    `;
    return existing[0]
      ? { notification: mapNotificationRow(existing[0]), changed: false }
      : undefined;
  }

  async markAllReadOwned(input: Parameters<NotificationRepository["markAllReadOwned"]>[0]) {
    const rows = await this.sql<{ count: number }[]>`
      with marked as (
        update notifications
        set read_at = ${input.readAt}
        where user_id = ${input.userId}
          and read_at is null
          and created_at <= ${input.cutoff}
        returning id
      )
      select count(*)::integer as count from marked
    `;
    return rows[0]?.count ?? 0;
  }
}

function mapNotificationRow(row: NotificationRow): Notification {
  return {
    adminRetryCount: row.admin_retry_count,
    canceledAt: row.canceled_at ?? undefined,
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data,
    dedupeKey: row.dedupe_key,
    status: row.status,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
    sentAt: row.sent_at ?? undefined,
    lastErrorCode: row.last_error_code ?? undefined
  };
}
