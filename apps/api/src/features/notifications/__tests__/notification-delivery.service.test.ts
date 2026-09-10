import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import { createPushTokenCipher } from "@/features/auth/push-token.crypto";
import type { DeviceDeliveryCredential } from "@/server/repositories/contracts/device-delivery-credential.repository";
import type { Notification } from "@/server/repositories/contracts/notification.repository";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { NotificationDeliveryService } from "../notification-delivery.service";
import type {
  NotificationProviderInput,
  NotificationProviderOutcome
} from "../notification-provider";

const now = new Date("2026-08-23T04:00:00.000Z");
const userId = "11111111-1111-4111-8111-111111111111";
const notificationId = "22222222-2222-4222-8222-222222222222";
const encryptionKey = Buffer.alloc(32, 7).toString("base64");
const cipher = createPushTokenCipher(encryptionKey);

describe("NotificationDeliveryService", () => {
  it("delivers all active devices once and skips terminal receipts on replay", async () => {
    const unitOfWork = createUnitOfWork([credential("credential-a", "device-a", "token-a"), credential("credential-b", "device-b", "token-b")]);
    const send = vi.fn(async (input: NotificationProviderInput) => {
      expect(input.provider).toBe("fcm");
      return { kind: "success" as const, providerMessageId: "message-id" };
    });
    const service = new NotificationDeliveryService(unitOfWork, { send }, cipher, {
      now: () => now,
      createId: sequenceIds()
    });

    await expect(service.deliver(notificationId)).resolves.toEqual({ status: "sent" });
    await expect(service.deliver(notificationId)).resolves.toEqual({ status: "sent" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map(([input]) => input.credential).sort()).toEqual(["token-a", "token-b"]);
    expect(unitOfWork.snapshot().notificationDeliveryReceipts).toHaveLength(2);
  });

  it("returns a terminal failed result when the user has no active device", async () => {
    const service = new NotificationDeliveryService(
      createUnitOfWork([]),
      { send: vi.fn() },
      cipher,
      { now: () => now }
    );
    await expect(service.deliver(notificationId)).resolves.toEqual({
      status: "failed",
      errorCode: "NO_ACTIVE_DEVICE"
    });
  });

  it("preserves mixed terminal outcomes, disables only the invalid version, and retries unresolved devices", async () => {
    const unitOfWork = createUnitOfWork([
      credential("credential-a", "device-a", "token-success"),
      credential("credential-b", "device-b", "token-invalid"),
      credential("credential-c", "device-c", "token-retry")
    ]);
    const attempts = new Map<string, number>();
    const send = vi.fn(async ({ credential: token }: { credential: string }) => {
      attempts.set(token, (attempts.get(token) ?? 0) + 1);
      const outcomes: Record<string, NotificationProviderOutcome> = {
        "token-success": { kind: "success", providerMessageId: "message-success" },
        "token-invalid": { kind: "invalid_credential", errorCode: "FCM_UNREGISTERED" },
        "token-retry":
          (attempts.get(token) ?? 0) === 1
            ? { kind: "temporary_failure", errorCode: "FCM_UNAVAILABLE" }
            : { kind: "success", providerMessageId: "message-retry" }
      };
      return outcomes[token]!;
    });
    const service = new NotificationDeliveryService(unitOfWork, { send }, cipher, {
      now: () => now,
      createId: sequenceIds()
    });

    await expect(service.deliver(notificationId)).rejects.toMatchObject({
      errorCode: "FCM_UNAVAILABLE"
    });
    const first = unitOfWork.snapshot();
    expect(first.deviceDeliveryCredentials.find((item) => item.id === "credential-b")).toMatchObject({
      enabled: false,
      disabledReason: "provider_invalid"
    });
    await expect(service.deliver(notificationId)).resolves.toEqual({ status: "sent" });
    expect(attempts).toEqual(
      new Map([
        ["token-success", 1],
        ["token-invalid", 1],
        ["token-retry", 2]
      ])
    );
  });
});

function createUnitOfWork(credentials: DeviceDeliveryCredential[]) {
  return new InMemoryUnitOfWork({ notifications: [notification()], deviceDeliveryCredentials: credentials });
}

function notification(): Notification {
  return {
    id: notificationId,
    userId,
    type: "assignment_update",
    title: "Cập nhật cứu hộ",
    body: "Mở ứng dụng để xem chi tiết.",
    data: { request_id: "request-1" },
    dedupeKey: "business-1",
    status: "pending",
    createdAt: now
  };
}

function credential(id: string, deviceId: string, rawToken: string): DeviceDeliveryCredential {
  const encrypted = cipher.encrypt(rawToken);
  return {
    id,
    deviceId,
    userId,
    provider: "fcm",
    credentialFingerprint: encrypted.fingerprint,
    credentialCiphertext: encrypted.ciphertext,
    credentialIv: encrypted.iv,
    credentialTag: encrypted.authTag,
    encryptionKeyVersion: 1,
    credentialVersion: 1,
    enabled: true,
    lastRegisteredAt: now,
    createdAt: now,
    updatedAt: now
  };
}

function sequenceIds() {
  let value = 0;
  return () => `00000000-0000-4000-8000-${String(++value).padStart(12, "0")}`;
}
