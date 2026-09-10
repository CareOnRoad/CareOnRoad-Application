import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { assertActorOwns, requireActorRole } from "../authorization";
import { AuthService } from "../auth.service";
import type { RequestActor } from "../auth.types";
import { createPushTokenCipher } from "../push-token.crypto";

const identity = {
  subject: "11111111-1111-4111-8111-111111111111",
  issuer: "https://careonroad.supabase.co/auth/v1",
  audience: ["authenticated"]
};

describe("AuthService", () => {
  it("bootstraps a rider profile idempotently with outbox and audit records", async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const service = new AuthService(unitOfWork, { now: () => new Date("2026-06-25T00:00:00Z") });

    const first = await service.bootstrapProfile(identity, { display_name: "Rider One" });
    const second = await service.bootstrapProfile(identity, { display_name: "Ignored update" });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      id: identity.subject,
      display_name: "Rider One",
      roles: ["rider"],
      status: "active"
    });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.users).toHaveLength(1);
    expect(snapshot.userRoles).toEqual([{ userId: identity.subject, role: "rider" }]);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.auditLogs).toHaveLength(1);
    expect(snapshot.outboxEvents[0]?.payload).toEqual({ resource_id: identity.subject });
    expect(snapshot.auditLogs[0]?.metadata).toEqual({
      resource_id: identity.subject,
      status: "active"
    });
    expect(JSON.stringify(snapshot.outboxEvents)).not.toContain("Rider One");
    expect(JSON.stringify(snapshot.auditLogs)).not.toContain("Rider One");
  });

  it("rolls profile, role, outbox, and audit state back when bootstrap fails", async () => {
    const unitOfWork = new InMemoryUnitOfWork({
      outboxEvents: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          topic: "user.profile.bootstrapped",
          aggregateType: "app_user",
          aggregateId: identity.subject,
          dedupeKey: `user.profile.bootstrapped:${identity.subject}`,
          payload: {},
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: new Date("2026-06-25T00:00:00Z"),
          createdAt: new Date("2026-06-25T00:00:00Z")
        }
      ]
    });

    await expect(
      new AuthService(unitOfWork).bootstrapProfile(identity, { display_name: "Rollback Rider" })
    ).rejects.toThrow("OUTBOX_DEDUPE_KEY_EXISTS");

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.users).toHaveLength(0);
    expect(snapshot.userRoles).toHaveLength(0);
    expect(snapshot.auditLogs).toHaveLength(0);
    expect(snapshot.outboxEvents).toHaveLength(1);
  });

  it("registers device metadata atomically without exposing the raw device key", async () => {
    const unitOfWork = new InMemoryUnitOfWork({
      users: [
        {
          id: identity.subject,
          displayName: "Rider",
          status: "active",
          createdAt: new Date("2026-06-25T00:00:00Z"),
          updatedAt: new Date("2026-06-25T00:00:00Z")
        }
      ],
      userRoles: [{ userId: identity.subject, role: "rider" }]
    });
    const ids = [
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555"
    ];
    const service = new AuthService(unitOfWork, {
      now: () => new Date("2026-06-25T01:00:00Z"),
      createId: () => ids.shift()!
    });
    const rawDeviceKey = "private-device-token-123456";

    await expect(
      service.registerDevice(identity, {
        device_key: rawDeviceKey,
        platform: "android"
      })
    ).resolves.toEqual({
      id: "33333333-3333-4333-8333-333333333333",
      platform: "android",
      enabled: true,
      last_registered_at: "2026-06-25T01:00:00.000Z",
      push_token_registered: false
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.userDevices).toHaveLength(1);
    expect(snapshot.userDevices[0]).toMatchObject({
      id: "33333333-3333-4333-8333-333333333333",
      userId: identity.subject,
      platform: "android",
      enabled: true
    });
    expect(snapshot.userDevices[0]?.deviceKeyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.auditLogs).toHaveLength(1);
    expect(JSON.stringify(snapshot)).not.toContain(rawDeviceKey);
  });

  it("registers, replays, rotates, and revokes push credentials without exposing tokens", async () => {
    const unitOfWork = createActiveRiderUnitOfWork();
    const now = new Date("2026-06-25T02:00:00Z");
    const service = new AuthService(unitOfWork, {
      now: () => now,
      pushTokenCipher: createTestPushCipher()
    });
    const firstRaw = "private-provider-token-first-123456";
    const secondRaw = "private-provider-token-second-654321";

    const registered = await service.registerDevice(identity, {
      device_key: "stable-installation-key-123456",
      platform: "android",
      push_provider: "fcm",
      push_token: firstRaw
    });
    expect(registered).toMatchObject({
      push_token_registered: true,
      push_provider: "fcm"
    });

    const lifecycleCount = unitOfWork
      .snapshot()
      .auditLogs.filter((item) => item.action.startsWith("user.device.push_token")).length;
    await service.rotatePushToken(identity, registered.id, {
      push_provider: "fcm",
      push_token: firstRaw
    });
    expect(
      unitOfWork
        .snapshot()
        .auditLogs.filter((item) => item.action.startsWith("user.device.push_token"))
    ).toHaveLength(lifecycleCount);

    await service.rotatePushToken(identity, registered.id, {
      push_provider: "fcm",
      push_token: secondRaw
    });
    let snapshot = unitOfWork.snapshot();
    expect(snapshot.deviceDeliveryCredentials).toHaveLength(2);
    expect(snapshot.deviceDeliveryCredentials.filter((item) => item.enabled)).toHaveLength(1);
    expect(snapshot.deviceDeliveryCredentials[0]).toMatchObject({
      enabled: false,
      disabledReason: "rotated"
    });
    expect(snapshot.deviceDeliveryCredentials[0]?.credentialCiphertext).toBeUndefined();
    expect(snapshot.deviceDeliveryCredentials[1]?.credentialVersion).toBe(2);

    await service.revokePushToken(identity, registered.id);
    await service.revokePushToken(identity, registered.id);
    snapshot = unitOfWork.snapshot();
    expect(snapshot.deviceDeliveryCredentials.filter((item) => item.enabled)).toHaveLength(0);
    expect(snapshot.deviceDeliveryCredentials[1]).toMatchObject({
      disabledReason: "user_revoked"
    });
    expect(JSON.stringify(snapshot)).not.toContain(firstRaw);
    expect(JSON.stringify(snapshot)).not.toContain(secondRaw);
  });

  it("enforces token ownership and stale provider invalidation guards", async () => {
    const unitOfWork = createActiveRiderUnitOfWork();
    const service = new AuthService(unitOfWork, {
      pushTokenCipher: createTestPushCipher()
    });
    const registered = await service.registerDevice(identity, {
      device_key: "stable-installation-key-ownership",
      platform: "ios",
      push_provider: "apns",
      push_token: "private-apns-provider-token-123456"
    });
    const credential = unitOfWork.snapshot().deviceDeliveryCredentials[0]!;

    await expect(
      service.revokePushToken(
        { ...identity, subject: "22222222-2222-4222-8222-222222222222" },
        registered.id
      )
    ).rejects.toMatchObject({ errorCode: "NOT_FOUND" });
    await expect(service.invalidatePushToken(credential.id, 99)).resolves.toBe(false);
    await expect(
      service.invalidatePushToken(credential.id, credential.credentialVersion)
    ).resolves.toBe(true);
    await expect(
      service.invalidatePushToken(credential.id, credential.credentialVersion)
    ).resolves.toBe(false);
  });

  it("keeps only the five newest enabled device registrations", async () => {
    const unitOfWork = createActiveRiderUnitOfWork();
    let tick = 0;
    const service = new AuthService(unitOfWork, {
      now: () => new Date(Date.UTC(2026, 5, 25, 3, tick++))
    });

    for (let index = 0; index < 6; index += 1) {
      await service.registerDevice(identity, {
        device_key: `stable-installation-key-${index}-123456`,
        platform: "android"
      });
    }

    const devices = unitOfWork.snapshot().userDevices;
    expect(devices.filter((device) => device.enabled)).toHaveLength(5);
    expect(devices[0]?.enabled).toBe(false);
    expect(devices.slice(1).every((device) => device.enabled)).toBe(true);
  });

  it("loads database-owned roles for the current actor", async () => {
    const unitOfWork = new InMemoryUnitOfWork({
      users: [
        {
          id: identity.subject,
          displayName: "Mechanic",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      userRoles: [
        { userId: identity.subject, role: "rider" },
        { userId: identity.subject, role: "mechanic" }
      ]
    });

    await expect(new AuthService(unitOfWork).getCurrentActor(identity)).resolves.toMatchObject({
      roles: ["mechanic", "rider"]
    });
  });

  it("rejects suspended users", async () => {
    const unitOfWork = new InMemoryUnitOfWork({
      users: [
        {
          id: identity.subject,
          status: "suspended",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      userRoles: [{ userId: identity.subject, role: "rider" }]
    });

    await expect(new AuthService(unitOfWork).getCurrentActor(identity)).rejects.toMatchObject({
      errorCode: "ACTOR_SUSPENDED",
      status: 403
    });
  });

  it("enforces roles and ownership", () => {
    const actor: RequestActor = {
      id: identity.subject,
      roles: ["rider"],
      status: "active"
    };

    expect(() => requireActorRole(actor, "rider")).not.toThrow();
    expect(() => requireActorRole(actor, "admin")).toThrow("required role");
    expect(() => assertActorOwns(actor, identity.subject)).not.toThrow();
    expect(() => assertActorOwns(actor, "22222222-2222-4222-8222-222222222222")).toThrow(
      "not visible"
    );
  });
});

function createActiveRiderUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [
      {
        id: identity.subject,
        displayName: "Rider",
        status: "active",
        createdAt: new Date("2026-06-25T00:00:00Z"),
        updatedAt: new Date("2026-06-25T00:00:00Z")
      }
    ],
    userRoles: [{ userId: identity.subject, role: "rider" }]
  });
}

function createTestPushCipher() {
  return createPushTokenCipher(Buffer.alloc(32, 9).toString("base64"));
}
