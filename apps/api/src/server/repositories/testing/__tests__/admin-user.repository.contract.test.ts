import { describe, expect, it } from "vitest";

import type { AuditLog } from "../../contracts/audit.repository";
import type {
  ApplicationUser,
  UserDevice,
  UserRoleRecord
} from "../../contracts/user.repository";
import { InMemoryUserRepository } from "../in-memory-user.repository";

const ADMIN_ONE = "11111111-1111-4111-8111-111111111111";
const ADMIN_TWO = "22222222-2222-4222-8222-222222222222";
const RIDER = "33333333-3333-4333-8333-333333333333";

describe("admin user repository contract", () => {
  it("provides deterministic cursor pagination and filters", async () => {
    const { repository } = fixture();
    const first = await repository.listAdminUsers({ limit: 2 });
    expect(first.items.map((item) => item.id)).toEqual([ADMIN_ONE, ADMIN_TWO]);
    expect(first.nextCursor).toBeDefined();
    const second = await repository.listAdminUsers({
      limit: 2,
      cursor: first.nextCursor!
    });
    expect(second.items.map((item) => item.id)).toEqual([RIDER]);

    await expect(
      repository.listAdminUsers({ limit: 10, role: "admin", status: "active" })
    ).resolves.toMatchObject({ items: [{ id: ADMIN_ONE }, { id: ADMIN_TWO }] });
  });

  it("locks status changes, mutates roles/devices, and counts active admins", async () => {
    const { repository } = fixture();
    await repository.acquireLastAdminGuard();
    await expect(repository.countActiveAdmins()).resolves.toBe(2);
    await repository.updateStatus(ADMIN_TWO, "suspended", new Date());
    await expect(repository.countActiveAdmins()).resolves.toBe(1);

    await expect(repository.grantRole(RIDER, "mechanic")).resolves.toBe(true);
    await expect(repository.grantRole(RIDER, "mechanic")).resolves.toBe(false);
    await expect(repository.revokeRole(RIDER, "mechanic")).resolves.toBe(true);

    const device = await repository.findDeviceForUpdate("device-1");
    expect(device?.enabled).toBe(true);
    await expect(repository.revokeDevice("device-1", new Date())).resolves.toMatchObject({
      enabled: false
    });
  });

  it("orders activity deterministically and supports activity cursors", async () => {
    const { repository } = fixture();
    const first = await repository.listAdminActivity({ userId: RIDER, limit: 1 });
    expect(first.items[0]?.action).toBe("admin.user.suspended");
    const second = await repository.listAdminActivity({
      userId: RIDER,
      limit: 1,
      cursor: first.nextCursor!
    });
    expect(second.items[0]?.action).toBe("admin.user.role.granted");
  });
});

function fixture() {
  const users: ApplicationUser[] = [
    user(ADMIN_ONE, "2026-07-05T00:00:00Z"),
    user(ADMIN_TWO, "2026-07-04T00:00:00Z"),
    user(RIDER, "2026-07-03T00:00:00Z")
  ];
  const roles: UserRoleRecord[] = [
    { userId: ADMIN_ONE, role: "admin" },
    { userId: ADMIN_TWO, role: "admin" },
    { userId: RIDER, role: "rider" }
  ];
  const devices: UserDevice[] = [
    {
      id: "device-1",
      userId: RIDER,
      deviceKeyHash: "a".repeat(64),
      platform: "android",
      enabled: true,
      lastRegisteredAt: new Date("2026-07-05T00:00:00Z"),
      createdAt: new Date("2026-07-05T00:00:00Z"),
      updatedAt: new Date("2026-07-05T00:00:00Z")
    }
  ];
  const auditLogs: AuditLog[] = [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorId: ADMIN_ONE,
      actorRole: "admin",
      action: "admin.user.suspended",
      entityType: "app_user",
      entityId: RIDER,
      metadata: { user_id: RIDER, new_status: "suspended" },
      createdAt: new Date("2026-07-06T02:00:00Z")
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: ADMIN_ONE,
      actorRole: "admin",
      action: "admin.user.role.granted",
      entityType: "app_user",
      entityId: RIDER,
      metadata: { user_id: RIDER, role: "mechanic" },
      createdAt: new Date("2026-07-06T01:00:00Z")
    }
  ];
  return { repository: new InMemoryUserRepository(users, roles, devices, auditLogs) };
}

function user(id: string, updatedAt: string): ApplicationUser {
  return {
    id,
    status: "active",
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date(updatedAt)
  };
}
