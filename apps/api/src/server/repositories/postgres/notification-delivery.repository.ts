import type { TransactionSql } from "postgres";

import type { PushProvider } from "../contracts/device-delivery-credential.repository";
import type {
  NotificationDeliveryReceipt,
  NotificationDeliveryRepository,
  NotificationDeliveryStatus
} from "../contracts/notification-delivery.repository";

type ReceiptRow = {
  id: string;
  notification_id: string;
  credential_id: string;
  credential_version: number;
  provider: PushProvider;
  status: NotificationDeliveryStatus;
  attempt_count: number;
  provider_message_id: string | null;
  last_error_code: string | null;
  last_attempted_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class PostgresNotificationDeliveryRepository
  implements NotificationDeliveryRepository
{
  constructor(private readonly sql: TransactionSql) {}

  async createIfAbsent(
    input: Parameters<NotificationDeliveryRepository["createIfAbsent"]>[0]
  ) {
    const rows = await this.sql<ReceiptRow[]>`
      insert into notification_delivery_receipts (
        id, notification_id, credential_id, credential_version, provider,
        created_at, updated_at
      ) values (
        ${input.id}, ${input.notificationId}, ${input.credentialId},
        ${input.credentialVersion}, ${input.provider}, ${input.createdAt}, ${input.createdAt}
      )
      on conflict (notification_id, credential_id, credential_version)
      do update set notification_id = excluded.notification_id
      returning *
    `;
    return mapReceipt(rows[0]!);
  }

  async listByNotificationId(notificationId: string) {
    const rows = await this.sql<ReceiptRow[]>`
      select * from notification_delivery_receipts
      where notification_id = ${notificationId}
      order by created_at, id
    `;
    return rows.map(mapReceipt);
  }

  async recordOutcome(input: Parameters<NotificationDeliveryRepository["recordOutcome"]>[0]) {
    const terminal = ["sent", "invalid", "permanent_failed"].includes(input.status);
    const rows = await this.sql<ReceiptRow[]>`
      update notification_delivery_receipts
      set status = ${input.status}::notification_delivery_status,
          attempt_count = attempt_count + 1,
          provider_message_id = ${input.providerMessageId ?? null},
          last_error_code = ${input.errorCode ?? null},
          last_attempted_at = ${input.attemptedAt},
          completed_at = ${terminal ? input.attemptedAt : null},
          updated_at = ${input.attemptedAt}
      where id = ${input.id}
      returning *
    `;
    if (!rows[0]) throw new Error("NOTIFICATION_DELIVERY_RECEIPT_NOT_FOUND");
    return mapReceipt(rows[0]);
  }
}

function mapReceipt(row: ReceiptRow): NotificationDeliveryReceipt {
  return {
    id: row.id,
    notificationId: row.notification_id,
    credentialId: row.credential_id,
    credentialVersion: row.credential_version,
    provider: row.provider,
    status: row.status,
    attemptCount: row.attempt_count,
    ...(row.provider_message_id ? { providerMessageId: row.provider_message_id } : {}),
    ...(row.last_error_code ? { lastErrorCode: row.last_error_code } : {}),
    ...(row.last_attempted_at ? { lastAttemptedAt: row.last_attempted_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
