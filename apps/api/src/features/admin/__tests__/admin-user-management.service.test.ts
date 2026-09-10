import { describe, expect, it } from "vitest";

import {
  type InMemoryFoundationState,
  InMemoryUnitOfWork
} from "@/server/repositories/testing/in-memory-unit-of-work";

import { AdminUserManagementService } from "../admin-user-management.service";
import { adminIdentity, ADMIN_USER_ID, RIDER_USER_ID } from "./admin-route-test-helpers";

const SECOND_ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const DEVICE_ID = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-07-06T01:00:00.000Z");

describe("AdminUserManagementService", () => {
  it("lists bounded users, details, devices, and sanitized activity", async () => {
    const unitOfWork = createState();
    const service = createService(unitOfWork);

    const first = await service.listUsers(adminIdentity, { limit: "2" });
    expect(first.items).toHaveLength(2);
    expect(first.page.has_more).toBe(true);
    const second = await service.listUsers(adminIdentity, {
      limit: "2",
      cursor: first.page.next_cursor
    });
    expect(second.items).toHaveLength(1);

    const detail = await service.getUser(adminIdentity, RIDER_USER_ID);
    expect(detail).toMatchObject({
      id: RIDER_USER_ID,
      roles: ["rider"],
      device_summary: { total: 1, enabled: 1 }
    });
    expect(JSON.stringify(detail)).not.toContain("device-secret");

    const devices = await service.listDevices(adminIdentity, RIDER_USER_ID, {
      limit: "10"
    });
    expect(devices.items[0]).toMatchObject({
      id: DEVICE_ID,
      device_key_fingerprint: "aaaaaaaaaaaa"
    });
    expect(JSON.stringify(devices)).not.toContain("a".repeat(64));
  });

  it("suspends, replays idempotently, reactivates, and archives without hard delete", async () => {
    const unitOfWork = createState();
    const service = createService(unitOfWork);
    const reason = { reason: "Compromised account investigation" };

    const suspended = await service.suspendUser(
      adminIdentity,
      RIDER_USER_ID,
      reason,
      "suspend-rider-key"
    );
    const replayed = await service.suspendUser(
      adminIdentity,
      RIDER_USER_ID,
      reason,
      "suspend-rider-key"
    );
    expect(suspended.status).toBe("suspended");
    expect(replayed).toEqual(suspended);
    expect(unitOfWork.snapshot().auditLogs).toHaveLength(1);
    expect(unitOfWork.snapshot().outboxEvents).toHaveLength(1);
    await expect(
      service.suspendUser(
        adminIdentity,
        RIDER_USER_ID,
        { reason: "A different reason must conflict on replay" },
        "suspend-rider-key"
      )
    ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });

    await service.reactivateUser(
      adminIdentity,
      RIDER_USER_ID,
      { reason: "Investigation completed successfully" },
      "reactivate-rider-key"
    );
    const archived = await service.archiveUser(
      adminIdentity,
      RIDER_USER_ID,
      { reason: "Account retention policy requires archive" },
      "archive-rider-key"
    );
    expect(archived.status).toBe("archived");
    expect(unitOfWork.snapshot().users.some((user) => user.id === RIDER_USER_ID)).toBe(
      true
    );
  });

  it("grants and revokes roles, revokes a device, and composes activity", async () => {
    const unitOfWork = createState();
    const service = createService(unitOfWork);

    await service.grantRole(
      adminIdentity,
      RIDER_USER_ID,
      { reason: "Approved mechanic onboarding workflow", role: "mechanic" },
      "grant-mechanic-role"
    );
    await service.revokeRole(
      adminIdentity,
      RIDER_USER_ID,
      { reason: "Mechanic onboarding was withdrawn", role: "mechanic" },
      "revoke-mechanic-role"
    );
    const device = await service.revokeDevice(
      adminIdentity,
      DEVICE_ID,
      { reason: "Registered device was reported compromised" },
      "revoke-device-key"
    );
    expect(device.enabled).toBe(false);

    const activity = await service.listActivity(adminIdentity, RIDER_USER_ID, {
      limit: "10"
    });
    expect(activity.items).toHaveLength(3);
    expect(activity.items.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        "admin.device.revoked",
        "admin.user.role.revoked",
        "admin.user.role.granted"
      ])
    );
    expect(JSON.stringify(activity)).not.toContain("device-secret");
  });

  it("protects the last active administrator", async () => {
    const unitOfWork = createState({ includeSecondAdmin: false });
    const service = createService(unitOfWork);

    await expect(
      service.suspendUser(
        adminIdentity,
        ADMIN_USER_ID,
        { reason: "Attempt to disable the final administrator" },
        "last-admin-suspend"
      )
    ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });
    await expect(
      service.revokeRole(
        adminIdentity,
        ADMIN_USER_ID,
        { reason: "Attempt to revoke final administrator role", role: "admin" },
        "last-admin-role"
      )
    ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });
    await expect(
      service.archiveUser(
        adminIdentity,
        ADMIN_USER_ID,
        { reason: "Attempt to archive the final administrator" },
        "last-admin-archive"
      )
    ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });
  });

  it("rolls back status and idempotency when the outbox write fails", async () => {
    const occurrenceId = "66666666-6666-4666-8666-666666666666";
    const unitOfWork = createState({
      outboxEvents: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          topic: "admin.user.suspended",
          aggregateType: "app_user",
          aggregateId: RIDER_USER_ID,
          dedupeKey: `admin.user.suspended:${RIDER_USER_ID}:${occurrenceId}`,
          payload: {},
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: now,
          createdAt: now
        }
      ]
    });
    const ids = [
      "55555555-5555-4555-8555-555555555555",
      occurrenceId,
      "88888888-8888-4888-8888-888888888888"
    ];
    const service = new AdminUserManagementService(unitOfWork, {
      now: () => now,
      createId: () => ids.shift()!
    });

    await expect(
      service.suspendUser(
        adminIdentity,
        RIDER_USER_ID,
        { reason: "Rollback must preserve the original account state" },
        "rollback-suspend-key"
      )
    ).rejects.toThrow("OUTBOX_DEDUPE_KEY_EXISTS");
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.users.find((user) => user.id === RIDER_USER_ID)?.status).toBe(
      "active"
    );
    expect(snapshot.idempotencyRecords).toHaveLength(0);
    expect(snapshot.auditLogs).toHaveLength(0);
  });
});

function createService(unitOfWork: InMemoryUnitOfWork) {
  return new AdminUserManagementService(unitOfWork, { now: () => now });
}

function createState(
  options: {
    includeSecondAdmin?: boolean;
    outboxEvents?: InMemoryFoundationState["outboxEvents"];
  } = {}
) {
  const users = [
    {
      id: ADMIN_USER_ID,
      displayName: "Admin One",
      status: "active" as const,
      createdAt: new Date("2026-07-01T00:00:00Z"),
      updatedAt: new Date("2026-07-05T00:00:00Z")
    },
    {
      id: RIDER_USER_ID,
      displayName: "Rider",
      phoneMasked: "***1234",
      status: "active" as const,
      createdAt: new Date("2026-07-02T00:00:00Z"),
      updatedAt: new Date("2026-07-04T00:00:00Z")
    }
  ];
  const userRoles = [
    { userId: ADMIN_USER_ID, role: "admin" as const },
    { userId: RIDER_USER_ID, role: "rider" as const }
  ];
  if (options.includeSecondAdmin !== false) {
    users.push({
      id: SECOND_ADMIN_ID,
      displayName: "Admin Two",
      status: "active",
      createdAt: new Date("2026-07-03T00:00:00Z"),
      updatedAt: new Date("2026-07-03T00:00:00Z")
    });
    userRoles.push({ userId: SECOND_ADMIN_ID, role: "admin" });
  }
  return new InMemoryUnitOfWork({
    users,
    userRoles,
    userDevices: [
      {
        id: DEVICE_ID,
        userId: RIDER_USER_ID,
        deviceKeyHash: "a".repeat(64),
        platform: "android",
        enabled: true,
        lastRegisteredAt: new Date("2026-07-05T00:00:00Z"),
        createdAt: new Date("2026-07-05T00:00:00Z"),
        updatedAt: new Date("2026-07-05T00:00:00Z")
      }
    ],
    outboxEvents: options.outboxEvents ?? []
  });
}
