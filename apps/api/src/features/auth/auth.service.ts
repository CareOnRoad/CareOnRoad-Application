import { createHash, randomUUID } from "node:crypto";

import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { INITIAL_MECHANIC_SERVICE_RADIUS_KM } from "@/server/repositories/contracts/mechanic.repository";
import type { UserDevice } from "@/server/repositories/contracts/user.repository";

import { requireActiveActor } from "./authorization";
import type {
  BootstrapProfileInput,
  RegisterDeviceInput,
  RotatePushTokenInput,
  UpdateProfileInput
} from "./auth.schemas";
import {
  AuthError,
  type RegisteredUserDevice,
  type RequestActor,
  type VerifiedSupabaseIdentity
} from "./auth.types";
import { createPushTokenCipher, type PushTokenCipher } from "./push-token.crypto";

const MAXIMUM_ACTIVE_DEVICES = 5;

export class AuthService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: {
      now?: () => Date;
      createId?: () => string;
      pushTokenCipher?: PushTokenCipher;
    } = {}
  ) {}

  getCurrentActor(identity: VerifiedSupabaseIdentity): Promise<RequestActor> {
    return this.unitOfWork.execute(async ({ users }) => {
      const actor = await users.findActorById(identity.subject);
      if (!actor) {
        throw new AuthError("NOT_FOUND", "Application profile not found.", 404);
      }
      const response = toRequestActor(actor);
      requireActiveActor(response);
      return response;
    });
  }

  bootstrapProfile(
    identity: VerifiedSupabaseIdentity,
    input: BootstrapProfileInput
  ): Promise<RequestActor> {
    return this.unitOfWork.execute(async (repositories) => {
      const { audit, mechanics, outbox, users } = repositories;
      const existing = await users.findActorById(identity.subject);
      if (existing) {
        const response = toRequestActor(existing);
        requireActiveActor(response);
        return response;
      }

      const now = this.options.now?.() ?? new Date();
      await users.createProfile({
        id: identity.subject,
        displayName: input.display_name ?? identity.displayName,
        phone: input.phone,
        phoneMasked: input.phone ? maskPhone(input.phone) : undefined,
        address: input.address,
        avatarUrl: input.avatar_url,
        status: "active",
        createdAt: now,
        updatedAt: now
      });

      const concurrentBootstrap = await users.findActorById(identity.subject);
      if (concurrentBootstrap?.roles.length) {
        const response = toRequestActor(concurrentBootstrap);
        requireActiveActor(response);
        return response;
      }

      const accountType = input.account_type ?? "rider";
      await users.addRole(identity.subject, accountType);
      if (accountType === "mechanic") {
        await mechanics.createProfile({
          userId: identity.subject,
          profileStatus: "pending",
          isAvailable: false,
          serviceRadiusKm: INITIAL_MECHANIC_SERVICE_RADIUS_KM,
          availabilityUpdatedAt: now,
          createdAt: now,
          updatedAt: now
        });
      }

      const createId = this.options.createId ?? randomUUID;
      await outbox.append({
        id: createId(),
        topic: "user.profile.bootstrapped",
        aggregateType: "app_user",
        aggregateId: identity.subject,
        dedupeKey: `user.profile.bootstrapped:${identity.subject}`,
        payload: { resource_id: identity.subject },
        createdAt: now,
        nextAttemptAt: now
      });
      await audit.append({
        id: createId(),
        actorId: identity.subject,
        actorRole: accountType,
        action: "user.profile.bootstrapped",
        entityType: "app_user",
        entityId: identity.subject,
        metadata: { status: "active", resource_id: identity.subject },
        createdAt: now
      });

      const actor = await users.findActorById(identity.subject);
      if (!actor) {
        throw new Error("Profile bootstrap did not create an actor.");
      }
      return toRequestActor(actor);
    });
  }

  updateProfile(
    identity: VerifiedSupabaseIdentity,
    input: UpdateProfileInput
  ): Promise<RequestActor> {
    return this.unitOfWork.execute(async (repositories) => {
      const { audit, outbox, users } = repositories;
      const existing = await users.findActorById(identity.subject);
      if (!existing) {
        throw new AuthError("NOT_FOUND", "Application profile not found.", 404);
      }
      requireActiveActor(toRequestActor(existing));

      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;

      const patch: Parameters<typeof users.updateProfile>[1] = {};
      if (input.display_name !== undefined) patch.displayName = input.display_name;
      if (input.phone !== undefined) {
        patch.phone = input.phone;
        patch.phoneMasked = maskPhone(input.phone);
      }
      if (input.address !== undefined) patch.address = input.address;
      if (input.avatar_url !== undefined) patch.avatarUrl = input.avatar_url;

      const updated = await users.updateProfile(identity.subject, patch, now);

      await outbox.append({
        id: createId(),
        topic: "user.profile.updated",
        aggregateType: "app_user",
        aggregateId: identity.subject,
        dedupeKey: `user.profile.updated:${identity.subject}:${updated.updatedAt.toISOString()}`,
        payload: { resource_id: identity.subject },
        createdAt: now,
        nextAttemptAt: now
      });
      await audit.append({
        id: createId(),
        actorId: identity.subject,
        actorRole: preferredAuditRole(updated.roles),
        action: "user.profile.updated",
        entityType: "app_user",
        entityId: identity.subject,
        metadata: { resource_id: identity.subject },
        createdAt: now
      });

      return toRequestActor(updated);
    });
  }

  registerDevice(
    identity: VerifiedSupabaseIdentity,
    input: RegisterDeviceInput
  ): Promise<RegisteredUserDevice> {
    return this.unitOfWork.execute(async (repositories) => {
      const { audit, outbox, users } = repositories;
      const actor = await users.findActorById(identity.subject);
      if (!actor) {
        throw new AuthError("NOT_FOUND", "Application profile not found.", 404);
      }
      requireActiveActor(toRequestActor(actor));

      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const device = await users.registerDevice({
        id: createId(),
        userId: identity.subject,
        deviceKeyHash: hashDeviceKey(input.device_key),
        platform: input.platform,
        registeredAt: now
      });
      const occurrenceId = createId();

      const push = input.push_token && input.push_provider
        ? await this.registerOrRotatePushCredential(
            repositories,
            actor,
            device,
            { push_token: input.push_token, push_provider: input.push_provider },
            now,
            createId
          )
        : undefined;

      const disabledDevices = await users.disableExcessDevices({
        userId: identity.subject,
        maximum: MAXIMUM_ACTIVE_DEVICES,
        protectedDeviceId: device.id,
        updatedAt: now
      });
      await repositories.deviceDeliveryCredentials.disableForDeviceIds({
        deviceIds: disabledDevices.map((item) => item.id),
        reason: "device_limit",
        disabledAt: now
      });

      await outbox.append({
        id: occurrenceId,
        topic: "user.device.registered",
        aggregateType: "user_device",
        aggregateId: device.id,
        dedupeKey: `user.device.registered:${device.id}:${occurrenceId}`,
        payload: { resource_id: device.id, status: "enabled" },
        createdAt: now,
        nextAttemptAt: now
      });
      await audit.append({
        id: createId(),
        actorId: identity.subject,
        actorRole: preferredAuditRole(actor.roles),
        action: "user.device.registered",
        entityType: "user_device",
        entityId: device.id,
        metadata: { resource_id: device.id, status: "enabled" },
        createdAt: now
      });

      return {
        id: device.id,
        platform: device.platform,
        enabled: device.enabled,
        last_registered_at: device.lastRegisteredAt.toISOString(),
        push_token_registered: Boolean(push),
        ...(push
          ? {
              push_provider: push.provider,
              push_token_updated_at: push.lastRegisteredAt.toISOString()
            }
          : {})
      };
    });
  }

  rotatePushToken(
    identity: VerifiedSupabaseIdentity,
    deviceId: string,
    input: RotatePushTokenInput
  ): Promise<RegisteredUserDevice> {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await this.loadActiveActor(repositories, identity);
      const device = await this.loadOwnedDevice(repositories, deviceId, identity.subject);
      const now = this.options.now?.() ?? new Date();
      const credential = await this.registerOrRotatePushCredential(
        repositories,
        actor,
        device,
        input,
        now,
        this.options.createId ?? randomUUID
      );
      return toRegisteredDevice(device, credential.provider, credential.lastRegisteredAt);
    });
  }

  revokePushToken(
    identity: VerifiedSupabaseIdentity,
    deviceId: string
  ): Promise<RegisteredUserDevice> {
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await this.loadActiveActor(repositories, identity);
      const device = await this.loadOwnedDevice(repositories, deviceId, identity.subject);
      const now = this.options.now?.() ?? new Date();
      const disabled = await repositories.deviceDeliveryCredentials.disableForDevice({
        deviceId: device.id,
        reason: "user_revoked",
        disabledAt: now
      });
      if (disabled) {
        await this.recordPushLifecycle(repositories, actor, device.id, "revoked", now);
      }
      return toRegisteredDevice(device);
    });
  }

  invalidatePushToken(credentialId: string, expectedVersion: number): Promise<boolean> {
    return this.unitOfWork.execute(async (repositories) => {
      const now = this.options.now?.() ?? new Date();
      const credential = await repositories.deviceDeliveryCredentials.disableIfCurrent({
        id: credentialId,
        expectedVersion,
        reason: "provider_invalid",
        disabledAt: now
      });
      if (!credential) return false;
      const createId = this.options.createId ?? randomUUID;
      await repositories.outbox.append({
        id: createId(),
        topic: "user.device.push_token.invalidated",
        aggregateType: "user_device",
        aggregateId: credential.deviceId,
        dedupeKey: `user.device.push_token.invalidated:${credential.id}:${expectedVersion}`,
        payload: { resource_id: credential.deviceId, status: "disabled" },
        createdAt: now,
        nextAttemptAt: now
      });
      await repositories.audit.append({
        id: createId(),
        action: "user.device.push_token.invalidated",
        entityType: "user_device",
        entityId: credential.deviceId,
        metadata: { resource_id: credential.deviceId, status: "disabled" },
        createdAt: now
      });
      return true;
    });
  }

  private async loadActiveActor(
    repositories: FoundationRepositories,
    identity: VerifiedSupabaseIdentity
  ) {
    const actor = await repositories.users.findActorById(identity.subject);
    if (!actor) throw new AuthError("NOT_FOUND", "Application profile not found.", 404);
    requireActiveActor(toRequestActor(actor));
    return actor;
  }

  private async loadOwnedDevice(
    repositories: FoundationRepositories,
    deviceId: string,
    userId: string
  ) {
    const device = await repositories.users.findDeviceForUpdate(deviceId);
    if (!device || device.userId !== userId) {
      throw new AuthError("NOT_FOUND", "Device not found.", 404);
    }
    if (!device.enabled) {
      throw new AuthError("CONFLICT", "Device is disabled.", 409);
    }
    return device;
  }

  private async registerOrRotatePushCredential(
    repositories: FoundationRepositories,
    actor: { id: string; roles: RequestActor["roles"] },
    device: UserDevice,
    input: RotatePushTokenInput,
    now: Date,
    createId: () => string
  ) {
    const encrypted = (this.options.pushTokenCipher ?? createPushTokenCipher()).encrypt(
      input.push_token
    );
    const current = await repositories.deviceDeliveryCredentials.findActiveByDeviceForUpdate(
      device.id
    );
    if (
      current?.provider === input.push_provider &&
      current.credentialFingerprint === encrypted.fingerprint
    ) {
      return current;
    }

    const duplicate =
      await repositories.deviceDeliveryCredentials.findActiveByFingerprintForUpdate(
        encrypted.fingerprint
      );
    if (duplicate && duplicate.userId !== actor.id) {
      throw new AuthError("CONFLICT", "Push credential is already registered.", 409);
    }
    if (current) {
      await repositories.deviceDeliveryCredentials.disableForDevice({
        deviceId: current.deviceId,
        reason: "rotated",
        disabledAt: now
      });
    }
    if (duplicate && duplicate.deviceId !== device.id) {
      await repositories.deviceDeliveryCredentials.disableForDevice({
        deviceId: duplicate.deviceId,
        reason: "rotated",
        disabledAt: now
      });
    }
    const credential = await repositories.deviceDeliveryCredentials.create({
      id: createId(),
      deviceId: device.id,
      userId: actor.id,
      provider: input.push_provider,
      credentialFingerprint: encrypted.fingerprint,
      credentialCiphertext: encrypted.ciphertext,
      credentialIv: encrypted.iv,
      credentialTag: encrypted.authTag,
      encryptionKeyVersion: 1,
      credentialVersion: Math.max(
        current?.credentialVersion ?? 0,
        duplicate?.credentialVersion ?? 0
      ) + 1,
      registeredAt: now
    });
    await this.recordPushLifecycle(
      repositories,
      actor,
      device.id,
      current || duplicate ? "rotated" : "registered",
      now,
      input.push_provider
    );
    return credential;
  }

  private async recordPushLifecycle(
    repositories: FoundationRepositories,
    actor: { id: string; roles: RequestActor["roles"] },
    deviceId: string,
    action: "registered" | "rotated" | "revoked",
    now: Date,
    provider?: RotatePushTokenInput["push_provider"]
  ) {
    const createId = this.options.createId ?? randomUUID;
    const occurrenceId = createId();
    const metadata = {
      resource_id: deviceId,
      status: action === "revoked" ? "disabled" : "enabled",
      ...(provider ? { provider } : {})
    };
    await repositories.outbox.append({
      id: occurrenceId,
      topic: `user.device.push_token.${action}`,
      aggregateType: "user_device",
      aggregateId: deviceId,
      dedupeKey: `user.device.push_token.${action}:${deviceId}:${occurrenceId}`,
      payload: metadata,
      createdAt: now,
      nextAttemptAt: now
    });
    await repositories.audit.append({
      id: createId(),
      actorId: actor.id,
      actorRole: preferredAuditRole(actor.roles),
      action: `user.device.push_token.${action}`,
      entityType: "user_device",
      entityId: deviceId,
      metadata,
      createdAt: now
    });
  }
}

function toRegisteredDevice(
  device: UserDevice,
  provider?: RotatePushTokenInput["push_provider"],
  pushUpdatedAt?: Date
): RegisteredUserDevice {
  return {
    id: device.id,
    platform: device.platform,
    enabled: device.enabled,
    last_registered_at: device.lastRegisteredAt.toISOString(),
    push_token_registered: Boolean(provider),
    ...(provider ? { push_provider: provider } : {}),
    ...(pushUpdatedAt ? { push_token_updated_at: pushUpdatedAt.toISOString() } : {})
  };
}

function toRequestActor(actor: {
  id: string;
  displayName?: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  roles: RequestActor["roles"];
  status: RequestActor["status"];
}): RequestActor {
  return {
    id: actor.id,
    ...(actor.displayName ? { display_name: actor.displayName } : {}),
    ...(actor.phone ? { phone: actor.phone } : {}),
    ...(actor.address ? { address: actor.address } : {}),
    ...(actor.avatarUrl ? { avatar_url: actor.avatarUrl } : {}),
    roles: actor.roles,
    status: actor.status
  };
}

function hashDeviceKey(deviceKey: string): string {
  return createHash("sha256").update(deviceKey).digest("hex");
}

/**
 * Mask một số điện thoại để hiển thị an toàn (vd: "+84 90 xxx 1234" → "+84 ****1234").
 * Nếu chuỗi quá ngắn (< 4 chữ số) thì trả về toàn "*" để tránh lộ dữ liệu.
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 4) return "*".repeat(digits.length);
  const tail = digits.slice(-4);
  return `*`.repeat(Math.max(0, digits.length - 4)) + tail;
}

function preferredAuditRole(roles: RequestActor["roles"]): RequestActor["roles"][number] {
  return roles.includes("admin")
    ? "admin"
    : roles.includes("mechanic")
      ? "mechanic"
      : "rider";
}
