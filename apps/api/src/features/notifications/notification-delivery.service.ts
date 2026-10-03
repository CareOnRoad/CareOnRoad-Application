import { randomUUID } from "node:crypto";

import type { PushTokenCipher } from "@/features/auth/push-token.crypto";
import { normalizeErrorCode } from "@/features/notifications/notification.service";
import type { DeviceDeliveryCredential } from "@/server/repositories/contracts/device-delivery-credential.repository";
import type { NotificationDeliveryReceipt } from "@/server/repositories/contracts/notification-delivery.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

import {
  NotificationDeliveryError,
  type NotificationProvider,
  type NotificationProviderOutcome
} from "./notification-provider";

const terminalStatuses = new Set(["sent", "invalid", "permanent_failed", "canceled"]);

export type NotificationDeliveryResult = {
  status: "sent" | "failed" | "canceled";
  errorCode?: string;
};

export class NotificationDeliveryService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly provider: NotificationProvider,
    private readonly cipher: PushTokenCipher | (() => PushTokenCipher),
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  async deliver(notificationId: string): Promise<NotificationDeliveryResult> {
    const now = this.options.now?.() ?? new Date();
    const createId = this.options.createId ?? randomUUID;
    const prepared = await this.unitOfWork.execute(async (repositories) => {
      const notification = await repositories.notifications.findByIdForUpdate(notificationId);
      if (!notification) throw new NotificationDeliveryError("NOTIFICATION_NOT_FOUND");
      if (notification.status === "canceled") return { notification, credentials: [], receipts: [] };
      const existingReceipts = await repositories.notificationDeliveries.listByNotificationId(notificationId);
      const credentials = await repositories.deviceDeliveryCredentials.listActiveByUserId(
        notification.userId
      );
      const receipts: NotificationDeliveryReceipt[] = [];
      for (const credential of credentials) {
        // Recovery targets failed receipts of the original delivery, never newly registered devices.
        if ((notification.adminRetryCount ?? 0) > 0 && !existingReceipts.some((row) => row.credentialId === credential.id && row.credentialVersion === credential.credentialVersion)) continue;
        receipts.push(
          await repositories.notificationDeliveries.createIfAbsent({
            id: createId(),
            notificationId,
            credentialId: credential.id,
            credentialVersion: credential.credentialVersion,
            provider: credential.provider,
            createdAt: now
          })
        );
      }
      const allReceipts = await repositories.notificationDeliveries.listByNotificationId(
        notificationId
      );
      const activeIds = new Set(credentials.map((item) => `${item.id}:${item.credentialVersion}`));
      for (const receipt of allReceipts) {
        if (!terminalStatuses.has(receipt.status) && !activeIds.has(`${receipt.credentialId}:${receipt.credentialVersion}`)) {
          const token = randomUUID();
          const claimed = await repositories.notificationDeliveries.claim({ id: receipt.id, token, now,
            leaseUntil: new Date(now.getTime() + 90_000) });
          if (!claimed) continue;
          await repositories.notificationDeliveries.recordOutcome({
            id: receipt.id,
            leaseToken: token,
            status: "permanent_failed",
            attemptedAt: now,
            errorCode: "PUSH_CREDENTIAL_DISABLED"
          });
        }
      }
      return { notification, credentials, receipts };
    });
    if (prepared.notification.status === "canceled") return { status: "canceled" };

    const credentialById = new Map(
      prepared.credentials.map((credential) => [credential.id, credential])
    );
    for (const receipt of prepared.receipts) {
      const claimTime = this.options.now?.() ?? new Date();
      const token = randomUUID();
      const claimed = await this.unitOfWork.execute(({ notificationDeliveries }) => notificationDeliveries.claim({
        id: receipt.id, token, now: claimTime, leaseUntil: new Date(claimTime.getTime() + 90_000)
      }));
      if (!claimed) continue;
      const credential = credentialById.get(receipt.credentialId);
      if (!credential) continue;
      let outcome: NotificationProviderOutcome;
      try {
        const rawCredential = this.decryptCredential(credential);
        outcome = await this.provider.send({
          provider: credential.provider, credential: rawCredential,
          title: prepared.notification.title, body: prepared.notification.body,
          data: { ...prepared.notification.data, notification_id: notificationId }, deliveryId: receipt.id
        });
      } catch {
        outcome = { kind: "temporary_failure", errorCode: "PUSH_DELIVERY_UNAVAILABLE" };
      }
      const attemptedAt = this.options.now?.() ?? new Date();
      await this.persistOutcome(claimed, credential, outcome, attemptedAt);
    }

    const finalReceipts = await this.unitOfWork.execute(({ notificationDeliveries }) =>
      notificationDeliveries.listByNotificationId(notificationId)
    );
    const retryable = finalReceipts.find((receipt) => !terminalStatuses.has(receipt.status));
    if (retryable) {
      const retryTimes = finalReceipts.filter((receipt) => !terminalStatuses.has(receipt.status))
        .flatMap((receipt) => [receipt.nextAttemptAt, receipt.leaseExpiresAt].filter((date): date is Date => Boolean(date)));
      throw new NotificationDeliveryError(retryable.lastErrorCode ?? "PUSH_DELIVERY_RETRYABLE",
        retryTimes.length ? new Date(Math.max(...retryTimes.map((date) => date.getTime()))) : undefined);
    }
    if (finalReceipts.some((receipt) => receipt.status === "sent")) {
      return { status: "sent" };
    }
    return {
      status: "failed",
      errorCode:
        finalReceipts.find((receipt) => receipt.lastErrorCode)?.lastErrorCode ??
        "NO_ACTIVE_DEVICE"
    };
  }

  private decryptCredential(credential: DeviceDeliveryCredential) {
    if (
      !credential.credentialCiphertext ||
      !credential.credentialIv ||
      !credential.credentialTag
    ) {
      throw new NotificationDeliveryError("PUSH_CREDENTIAL_UNAVAILABLE");
    }
    try {
      return (typeof this.cipher === "function" ? this.cipher() : this.cipher).decrypt({
        ciphertext: credential.credentialCiphertext,
        iv: credential.credentialIv,
        authTag: credential.credentialTag,
        fingerprint: credential.credentialFingerprint
      });
    } catch {
      throw new NotificationDeliveryError("PUSH_TOKEN_DECRYPTION_FAILED");
    }
  }

  private persistOutcome(
    receipt: NotificationDeliveryReceipt,
    credential: DeviceDeliveryCredential,
    outcome: NotificationProviderOutcome,
    attemptedAt: Date
  ) {
    const mapped = mapOutcome(outcome);
    return this.unitOfWork.execute(async (repositories) => {
      const saved = await repositories.notificationDeliveries.recordOutcome({
        id: receipt.id,
        status: mapped.status,
        attemptedAt, leaseToken: receipt.leaseToken,
        ...((outcome.kind === "throttled" || outcome.kind === "temporary_failure") &&
          (outcome.retryAfter || outcome.kind === "throttled") ? {
            nextAttemptAt: new Date(Math.max(outcome.retryAfter?.getTime() ?? 0,
              outcome.kind === "throttled" ? attemptedAt.getTime() + 60_000 : 0))
          } : {}),
        ...(mapped.providerMessageId
          ? { providerMessageId: mapped.providerMessageId }
          : {}),
        ...(mapped.errorCode ? { errorCode: mapped.errorCode } : {})
      });
      if (mapped.status === "invalid") {
        await repositories.deviceDeliveryCredentials.disableIfCurrent({
          id: credential.id,
          expectedVersion: credential.credentialVersion,
          reason: "provider_invalid",
          disabledAt: attemptedAt
        });
      }
      return saved;
    });
  }
}

function mapOutcome(outcome: NotificationProviderOutcome): {
  status: "sent" | "invalid" | "permanent_failed" | "retryable_failed";
  providerMessageId?: string;
  errorCode?: string;
} {
  if (outcome.kind === "success") {
    return {
      status: "sent",
      ...(outcome.providerMessageId
        ? { providerMessageId: outcome.providerMessageId.slice(0, 300) }
        : {})
    };
  }
  const errorCode = normalizeErrorCode(outcome.errorCode);
  if (outcome.kind === "invalid_credential") return { status: "invalid", errorCode };
  if (outcome.kind === "permanent_failure") {
    return { status: "permanent_failed", errorCode };
  }
  return { status: "retryable_failed", errorCode };
}
