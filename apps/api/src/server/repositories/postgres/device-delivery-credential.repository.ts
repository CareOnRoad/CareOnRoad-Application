import type { TransactionSql } from "postgres";

import type {
  CreateDeviceDeliveryCredential,
  DeviceDeliveryCredential,
  DeviceDeliveryCredentialRepository,
  PushCredentialDisabledReason,
  PushProvider
} from "../contracts/device-delivery-credential.repository";

type CredentialRow = {
  id: string;
  device_id: string;
  user_id: string;
  provider: PushProvider;
  credential_fingerprint: string;
  credential_ciphertext: string | null;
  credential_iv: string | null;
  credential_tag: string | null;
  encryption_key_version: number;
  credential_version: number;
  enabled: boolean;
  last_registered_at: Date;
  disabled_at: Date | null;
  disabled_reason: PushCredentialDisabledReason | null;
  created_at: Date;
  updated_at: Date;
};

export class PostgresDeviceDeliveryCredentialRepository
  implements DeviceDeliveryCredentialRepository
{
  constructor(private readonly sql: TransactionSql) {}

  async listActiveByUserId(userId: string) {
    const rows = await this.sql<CredentialRow[]>`
      select * from device_delivery_credentials
      where user_id = ${userId} and enabled = true
      order by updated_at desc, id desc
    `;
    return rows.map(mapCredential);
  }

  async findActiveByDeviceForUpdate(deviceId: string) {
    const rows = await this.sql<CredentialRow[]>`
      select * from device_delivery_credentials
      where device_id = ${deviceId} and enabled = true
      for update
    `;
    return rows[0] ? mapCredential(rows[0]) : undefined;
  }

  async findActiveByFingerprintForUpdate(fingerprint: string) {
    const rows = await this.sql<CredentialRow[]>`
      select * from device_delivery_credentials
      where credential_fingerprint = ${fingerprint}
        and enabled = true
      for update
    `;
    return rows[0] ? mapCredential(rows[0]) : undefined;
  }

  async create(input: CreateDeviceDeliveryCredential) {
    const rows = await this.sql<CredentialRow[]>`
      insert into device_delivery_credentials (
        id, device_id, user_id, provider, credential_fingerprint,
        credential_ciphertext, credential_iv, credential_tag,
        encryption_key_version, credential_version, enabled,
        last_registered_at, created_at, updated_at
      ) values (
        ${input.id}, ${input.deviceId}, ${input.userId}, ${input.provider},
        ${input.credentialFingerprint}, ${input.credentialCiphertext},
        ${input.credentialIv}, ${input.credentialTag}, ${input.encryptionKeyVersion},
        ${input.credentialVersion}, true, ${input.registeredAt},
        ${input.registeredAt}, ${input.registeredAt}
      )
      returning *
    `;
    return mapCredential(rows[0]!);
  }

  async disableForDevice(input: {
    deviceId: string;
    reason: PushCredentialDisabledReason;
    disabledAt: Date;
  }) {
    const rows = await this.sql<CredentialRow[]>`
      update device_delivery_credentials
      set enabled = false,
          credential_ciphertext = null,
          credential_iv = null,
          credential_tag = null,
          disabled_at = ${input.disabledAt},
          disabled_reason = ${input.reason},
          updated_at = ${input.disabledAt}
      where device_id = ${input.deviceId} and enabled = true
      returning *
    `;
    return rows[0] ? mapCredential(rows[0]) : undefined;
  }

  async disableForDeviceIds(input: {
    deviceIds: string[];
    reason: PushCredentialDisabledReason;
    disabledAt: Date;
  }) {
    if (input.deviceIds.length === 0) return 0;
    const rows = await this.sql<{ count: number }[]>`
      with disabled as (
        update device_delivery_credentials
        set enabled = false,
            credential_ciphertext = null,
            credential_iv = null,
            credential_tag = null,
            disabled_at = ${input.disabledAt},
            disabled_reason = ${input.reason},
            updated_at = ${input.disabledAt}
        where device_id = any(${input.deviceIds}::uuid[]) and enabled = true
        returning id
      )
      select count(*)::integer as count from disabled
    `;
    return rows[0]?.count ?? 0;
  }

  async disableIfCurrent(input: {
    id: string;
    expectedVersion: number;
    reason: "provider_invalid";
    disabledAt: Date;
  }) {
    const rows = await this.sql<CredentialRow[]>`
      update device_delivery_credentials
      set enabled = false,
          credential_ciphertext = null,
          credential_iv = null,
          credential_tag = null,
          disabled_at = ${input.disabledAt},
          disabled_reason = ${input.reason},
          updated_at = ${input.disabledAt}
      where id = ${input.id}
        and credential_version = ${input.expectedVersion}
        and enabled = true
      returning *
    `;
    return rows[0] ? mapCredential(rows[0]) : undefined;
  }
}

function mapCredential(row: CredentialRow): DeviceDeliveryCredential {
  return {
    id: row.id,
    deviceId: row.device_id,
    userId: row.user_id,
    provider: row.provider,
    credentialFingerprint: row.credential_fingerprint,
    ...(row.credential_ciphertext
      ? { credentialCiphertext: row.credential_ciphertext }
      : {}),
    ...(row.credential_iv ? { credentialIv: row.credential_iv } : {}),
    ...(row.credential_tag ? { credentialTag: row.credential_tag } : {}),
    encryptionKeyVersion: row.encryption_key_version,
    credentialVersion: row.credential_version,
    enabled: row.enabled,
    lastRegisteredAt: row.last_registered_at,
    ...(row.disabled_at ? { disabledAt: row.disabled_at } : {}),
    ...(row.disabled_reason ? { disabledReason: row.disabled_reason } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
