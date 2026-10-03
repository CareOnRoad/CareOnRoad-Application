import { filterPage } from "@/lib/list-pagination";
import type {
  NotificationDeliveryReceipt,
  NotificationDeliveryRepository
} from "../contracts/notification-delivery.repository";

export class InMemoryNotificationDeliveryRepository
  implements NotificationDeliveryRepository
{
  constructor(private readonly receipts: NotificationDeliveryReceipt[]) {}

  async listByNotificationIdForUpdate(id: string) { return (await this.listByNotificationId(id)).slice(0, 101); }
  async listPage(id: string, limit: number, cursor?: import("@/lib/list-pagination").PageCursor) { return filterPage(await this.listByNotificationId(id), { limit, cursor }); }
  async retryFailed(input: { ids: string[]; now: Date }) {
    const rows = this.receipts.filter((row) => input.ids.includes(row.id) && ["retryable_failed", "permanent_failed"].includes(row.status) && (!row.leaseExpiresAt || row.leaseExpiresAt <= input.now));
    for (const row of rows) Object.assign(row, { status: "pending", completedAt: undefined, nextAttemptAt: input.now, leaseToken: undefined, leaseExpiresAt: undefined, lastErrorCode: undefined, updatedAt: input.now });
    return rows.length;
  }
  async cancelPending(input: { notificationId: string; now: Date }) {
    const rows = this.receipts.filter((row) => row.notificationId === input.notificationId && ["pending", "retryable_failed"].includes(row.status) && (!row.leaseExpiresAt || row.leaseExpiresAt <= input.now));
    for (const row of rows) Object.assign(row, { status: "canceled", completedAt: input.now, nextAttemptAt: undefined, leaseToken: undefined, leaseExpiresAt: undefined, updatedAt: input.now }); return rows.length;
  }

  async claim(input: Parameters<NotificationDeliveryRepository["claim"]>[0]) {
    const receipt = this.receipts.find((item) => item.id === input.id);
    if (!receipt || !["pending", "retryable_failed"].includes(receipt.status) ||
      (receipt.leaseExpiresAt && receipt.leaseExpiresAt > input.now) ||
      (receipt.nextAttemptAt && receipt.nextAttemptAt > input.now)) return undefined;
    receipt.leaseToken = input.token;
    receipt.leaseExpiresAt = input.leaseUntil;
    return { ...receipt };
  }

  async createIfAbsent(
    input: Parameters<NotificationDeliveryRepository["createIfAbsent"]>[0]
  ) {
    const existing = this.receipts.find(
      (item) =>
        item.notificationId === input.notificationId &&
        item.credentialId === input.credentialId &&
        item.credentialVersion === input.credentialVersion
    );
    if (existing) return existing;
    const receipt: NotificationDeliveryReceipt = {
      ...input,
      status: "pending",
      attemptCount: 0,
      updatedAt: input.createdAt
    };
    this.receipts.push(receipt);
    return receipt;
  }

  async listByNotificationId(notificationId: string) {
    return this.receipts.filter((item) => item.notificationId === notificationId);
  }

  async recordOutcome(input: Parameters<NotificationDeliveryRepository["recordOutcome"]>[0]) {
    const receipt = this.receipts.find((item) => item.id === input.id);
    if (!receipt) throw new Error("NOTIFICATION_DELIVERY_RECEIPT_NOT_FOUND");
    if (!["pending", "retryable_failed"].includes(receipt.status) || receipt.leaseToken !== input.leaseToken ||
      (receipt.leaseExpiresAt && receipt.leaseExpiresAt <= input.attemptedAt)) {
      throw new Error("NOTIFICATION_DELIVERY_LEASE_LOST");
    }
    receipt.leaseToken = undefined;
    receipt.leaseExpiresAt = undefined;
    receipt.nextAttemptAt = input.nextAttemptAt;
    receipt.status = input.status;
    receipt.attemptCount += 1;
    receipt.lastAttemptedAt = input.attemptedAt;
    receipt.updatedAt = input.attemptedAt;
    receipt.providerMessageId = input.providerMessageId;
    receipt.lastErrorCode = input.errorCode;
    receipt.completedAt = ["sent", "invalid", "permanent_failed", "canceled"].includes(input.status)
      ? input.attemptedAt
      : undefined;
    return receipt;
  }
}
