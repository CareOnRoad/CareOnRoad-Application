import type {
  CreateDeviceDeliveryCredential,
  DeviceDeliveryCredential,
  DeviceDeliveryCredentialRepository,
  PushCredentialDisabledReason
} from "../contracts/device-delivery-credential.repository";

export class InMemoryDeviceDeliveryCredentialRepository
  implements DeviceDeliveryCredentialRepository
{
  constructor(private readonly credentials: DeviceDeliveryCredential[]) {}

  async listActiveByUserId(userId: string) {
    return this.credentials.filter((item) => item.userId === userId && item.enabled);
  }

  async findActiveByDeviceForUpdate(deviceId: string) {
    return this.credentials.find((item) => item.deviceId === deviceId && item.enabled);
  }

  async findActiveByFingerprintForUpdate(fingerprint: string) {
    return this.credentials.find(
      (item) =>
        item.credentialFingerprint === fingerprint &&
        item.enabled
    );
  }

  async create(input: CreateDeviceDeliveryCredential) {
    if (
      this.credentials.some(
        (item) =>
          item.enabled &&
          (item.deviceId === input.deviceId ||
            item.credentialFingerprint === input.credentialFingerprint)
      )
    ) {
      throw new Error("ACTIVE_PUSH_CREDENTIAL_CONFLICT");
    }
    const credential: DeviceDeliveryCredential = {
      id: input.id,
      deviceId: input.deviceId,
      userId: input.userId,
      provider: input.provider,
      credentialFingerprint: input.credentialFingerprint,
      credentialCiphertext: input.credentialCiphertext,
      credentialIv: input.credentialIv,
      credentialTag: input.credentialTag,
      encryptionKeyVersion: input.encryptionKeyVersion,
      credentialVersion: input.credentialVersion,
      enabled: true,
      lastRegisteredAt: input.registeredAt,
      createdAt: input.registeredAt,
      updatedAt: input.registeredAt
    };
    this.credentials.push(credential);
    return credential;
  }

  async disableForDevice(input: {
    deviceId: string;
    reason: PushCredentialDisabledReason;
    disabledAt: Date;
  }) {
    const credential = this.credentials.find(
      (item) => item.deviceId === input.deviceId && item.enabled
    );
    if (!credential) return undefined;
    disableCredential(credential, input.reason, input.disabledAt);
    return credential;
  }

  async disableForDeviceIds(input: {
    deviceIds: string[];
    reason: PushCredentialDisabledReason;
    disabledAt: Date;
  }) {
    const ids = new Set(input.deviceIds);
    let count = 0;
    for (const credential of this.credentials) {
      if (credential.enabled && ids.has(credential.deviceId)) {
        disableCredential(credential, input.reason, input.disabledAt);
        count += 1;
      }
    }
    return count;
  }

  async disableIfCurrent(input: {
    id: string;
    expectedVersion: number;
    reason: "provider_invalid";
    disabledAt: Date;
  }) {
    const credential = this.credentials.find(
      (item) =>
        item.id === input.id &&
        item.enabled &&
        item.credentialVersion === input.expectedVersion
    );
    if (!credential) return undefined;
    disableCredential(credential, input.reason, input.disabledAt);
    return credential;
  }
}

function disableCredential(
  credential: DeviceDeliveryCredential,
  reason: PushCredentialDisabledReason,
  at: Date
) {
  credential.enabled = false;
  delete credential.credentialCiphertext;
  delete credential.credentialIv;
  delete credential.credentialTag;
  credential.disabledAt = at;
  credential.disabledReason = reason;
  credential.updatedAt = at;
}
