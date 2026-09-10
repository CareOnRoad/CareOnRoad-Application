export const pushProviders = ["fcm", "apns", "webpush"] as const;
export type PushProvider = (typeof pushProviders)[number];

export const pushCredentialDisabledReasons = [
  "rotated",
  "user_revoked",
  "provider_invalid",
  "device_limit",
  "admin_revoked"
] as const;
export type PushCredentialDisabledReason =
  (typeof pushCredentialDisabledReasons)[number];

export type DeviceDeliveryCredential = {
  id: string;
  deviceId: string;
  userId: string;
  provider: PushProvider;
  credentialFingerprint: string;
  credentialCiphertext?: string;
  credentialIv?: string;
  credentialTag?: string;
  encryptionKeyVersion: number;
  credentialVersion: number;
  enabled: boolean;
  lastRegisteredAt: Date;
  disabledAt?: Date;
  disabledReason?: PushCredentialDisabledReason;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateDeviceDeliveryCredential = {
  id: string;
  deviceId: string;
  userId: string;
  provider: PushProvider;
  credentialFingerprint: string;
  credentialCiphertext: string;
  credentialIv: string;
  credentialTag: string;
  encryptionKeyVersion: number;
  credentialVersion: number;
  registeredAt: Date;
};

export interface DeviceDeliveryCredentialRepository {
  listActiveByUserId(userId: string): Promise<DeviceDeliveryCredential[]>;
  findActiveByDeviceForUpdate(deviceId: string): Promise<DeviceDeliveryCredential | undefined>;
  findActiveByFingerprintForUpdate(
    fingerprint: string
  ): Promise<DeviceDeliveryCredential | undefined>;
  create(input: CreateDeviceDeliveryCredential): Promise<DeviceDeliveryCredential>;
  disableForDevice(input: {
    deviceId: string;
    reason: PushCredentialDisabledReason;
    disabledAt: Date;
  }): Promise<DeviceDeliveryCredential | undefined>;
  disableForDeviceIds(input: {
    deviceIds: string[];
    reason: PushCredentialDisabledReason;
    disabledAt: Date;
  }): Promise<number>;
  disableIfCurrent(input: {
    id: string;
    expectedVersion: number;
    reason: "provider_invalid";
    disabledAt: Date;
  }): Promise<DeviceDeliveryCredential | undefined>;
}
