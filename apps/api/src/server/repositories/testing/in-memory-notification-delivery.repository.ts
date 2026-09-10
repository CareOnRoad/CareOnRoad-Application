import type {
  NotificationDeliveryReceipt,
  NotificationDeliveryRepository
} from "../contracts/notification-delivery.repository";

export class InMemoryNotificationDeliveryRepository
  implements NotificationDeliveryRepository
{
  constructor(private readonly receipts: NotificationDeliveryReceipt[]) {}

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
    receipt.status = input.status;
    receipt.attemptCount += 1;
    receipt.lastAttemptedAt = input.attemptedAt;
    receipt.updatedAt = input.attemptedAt;
    receipt.providerMessageId = input.providerMessageId;
    receipt.lastErrorCode = input.errorCode;
    receipt.completedAt = ["sent", "invalid", "permanent_failed"].includes(input.status)
      ? input.attemptedAt
      : undefined;
    return receipt;
  }
}
