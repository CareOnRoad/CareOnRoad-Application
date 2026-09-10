import { describe, expect, it } from "vitest";

import { InMemoryDeviceDeliveryCredentialRepository } from "../in-memory-device-delivery-credential.repository";

describe("device delivery credential repository contract", () => {
  it("enforces active uniqueness, crypto-erases disable, and guards stale invalidation", async () => {
    const state: ConstructorParameters<typeof InMemoryDeviceDeliveryCredentialRepository>[0] = [];
    const repository = new InMemoryDeviceDeliveryCredentialRepository(state);
    const at = new Date("2026-06-25T00:00:00Z");
    const created = await repository.create({
      id: "credential-1",
      deviceId: "device-1",
      userId: "user-1",
      provider: "fcm",
      credentialFingerprint: "a".repeat(64),
      credentialCiphertext: "ciphertext",
      credentialIv: "iv",
      credentialTag: "tag",
      encryptionKeyVersion: 1,
      credentialVersion: 1,
      registeredAt: at
    });

    await expect(
      repository.create({
        id: "credential-2",
        deviceId: "device-2",
        userId: "user-2",
        provider: "webpush",
        credentialFingerprint: "a".repeat(64),
        credentialCiphertext: "ciphertext",
        credentialIv: "iv",
        credentialTag: "tag",
        encryptionKeyVersion: 1,
        credentialVersion: 1,
        registeredAt: at
      })
    ).rejects.toThrow("CONFLICT");
    await expect(
      repository.disableIfCurrent({
        id: created.id,
        expectedVersion: 2,
        reason: "provider_invalid",
        disabledAt: at
      })
    ).resolves.toBeUndefined();

    await repository.disableForDevice({
      deviceId: created.deviceId,
      reason: "user_revoked",
      disabledAt: at
    });
    expect(state[0]).toMatchObject({ enabled: false, disabledReason: "user_revoked" });
    expect(state[0]?.credentialCiphertext).toBeUndefined();
    expect(state[0]?.credentialIv).toBeUndefined();
    expect(state[0]?.credentialTag).toBeUndefined();
  });
});
