import { describe, expect, it, vi } from "vitest";

import { AuthError } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AdminUserManagementService } from "../admin-user-management.service";
import { createAdminUserRouteHandlers } from "../admin-user.route-handlers";
import {
  adminIdentity,
  ADMIN_USER_ID,
  createAdminRequest,
  expectApiError,
  RIDER_USER_ID
} from "./admin-route-test-helpers";

const DEVICE_ID = "44444444-4444-4444-8444-444444444444";
const SECOND_ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const reason = { reason: "Approved administrative account operation" };

describe("admin user route handlers", () => {
  it("enforces authentication and active-admin authorization", async () => {
    const handlers = createHandlers();
    await expectApiError(
      await handlers.listUsers(createAdminRequest("/api/v1/admin/users")),
      401,
      "UNAUTHORIZED"
    );

    const riderHandlers = createHandlers(RIDER_USER_ID);
    await expectApiError(
      await riderHandlers.listUsers(
        createAdminRequest("/api/v1/admin/users", { token: "valid-token" })
      ),
      403,
      "FORBIDDEN"
    );
  });

  it("validates filters, reasons, identifiers, and idempotency keys", async () => {
    const handlers = createHandlers();
    await expectApiError(
      await handlers.listUsers(
        createAdminRequest("/api/v1/admin/users?limit=101", {
          token: "valid-token"
        })
      ),
      400,
      "INVALID_INPUT"
    );
    await expectApiError(
      await handlers.suspendUser(
        createAdminRequest(`/api/v1/admin/users/${RIDER_USER_ID}/suspend`, {
          method: "POST",
          token: "valid-token",
          body: reason
        }),
        RIDER_USER_ID
      ),
      400,
      "INVALID_INPUT"
    );
    await expectApiError(
      await handlers.getUser(
        createAdminRequest("/api/v1/admin/users/not-a-uuid", {
          token: "valid-token"
        }),
        "not-a-uuid"
      ),
      400,
      "INVALID_INPUT"
    );
  });

  it("exposes all Patch B operations with safe response shapes", async () => {
    const handlers = createHandlers();
    const read = (path: string) =>
      createAdminRequest(path, { token: "valid-token" });
    const command = (path: string, body: unknown, key: string) =>
      createAdminRequest(path, {
        method: "POST",
        token: "valid-token",
        body,
        idempotencyKey: key
      });

    expect(
      await (
        await handlers.listUsers(
          read("/api/v1/admin/users?role=rider&status=active&limit=10")
        )
      ).json()
    ).toMatchObject({ items: [{ id: RIDER_USER_ID }] });
    expect(
      await (
        await handlers.getUser(
          read(`/api/v1/admin/users/${RIDER_USER_ID}`),
          RIDER_USER_ID
        )
      ).json()
    ).toMatchObject({ id: RIDER_USER_ID, roles: ["rider"] });
    const devices = await (
      await handlers.listDevices(
        read(`/api/v1/admin/users/${RIDER_USER_ID}/devices`),
        RIDER_USER_ID
      )
    ).json();
    expect(devices.items[0]).toMatchObject({
      id: DEVICE_ID,
      device_key_fingerprint: "aaaaaaaaaaaa"
    });
    expect(JSON.stringify(devices)).not.toContain("a".repeat(64));

    expect(
      (
        await handlers.grantRole(
          command(
            `/api/v1/admin/users/${RIDER_USER_ID}/roles/grant`,
            { ...reason, role: "mechanic" },
            "grant-role-key"
          ),
          RIDER_USER_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.revokeRole(
          command(
            `/api/v1/admin/users/${RIDER_USER_ID}/roles/revoke`,
            { ...reason, role: "mechanic" },
            "revoke-role-key"
          ),
          RIDER_USER_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.revokeDevice(
          command(
            `/api/v1/admin/devices/${DEVICE_ID}/revoke`,
            reason,
            "revoke-device-key"
          ),
          DEVICE_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.suspendUser(
          command(
            `/api/v1/admin/users/${RIDER_USER_ID}/suspend`,
            reason,
            "suspend-user-key"
          ),
          RIDER_USER_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.reactivateUser(
          command(
            `/api/v1/admin/users/${RIDER_USER_ID}/reactivate`,
            reason,
            "reactivate-user-key"
          ),
          RIDER_USER_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.archiveUser(
          command(
            `/api/v1/admin/users/${RIDER_USER_ID}/archive`,
            reason,
            "archive-user-key"
          ),
          RIDER_USER_ID
        )
      ).status
    ).toBe(200);

    const activity = await (
      await handlers.listActivity(
        read(`/api/v1/admin/users/${RIDER_USER_ID}/activity?limit=10`),
        RIDER_USER_ID
      )
    ).json();
    expect(activity.items).toHaveLength(6);
    expect(JSON.stringify(activity)).not.toContain("Approved administrative");
  });
});

function createHandlers(subject = ADMIN_USER_ID) {
  const timestamp = new Date("2026-07-06T00:00:00.000Z");
  const unitOfWork = new InMemoryUnitOfWork({
    users: [
      user(ADMIN_USER_ID, "active", timestamp),
      user(SECOND_ADMIN_ID, "active", timestamp),
      user(RIDER_USER_ID, "active", timestamp)
    ],
    userRoles: [
      { userId: ADMIN_USER_ID, role: "admin" },
      { userId: SECOND_ADMIN_ID, role: "admin" },
      { userId: RIDER_USER_ID, role: "rider" }
    ],
    userDevices: [
      {
        id: DEVICE_ID,
        userId: RIDER_USER_ID,
        deviceKeyHash: "a".repeat(64),
        platform: "android",
        enabled: true,
        lastRegisteredAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]
  });
  return createAdminUserRouteHandlers({
    authenticate: vi.fn(async (request: Request) => {
      if (!request.headers.has("authorization")) {
        throw new AuthError("UNAUTHORIZED", "Authentication is required.", 401);
      }
      return { ...adminIdentity, subject };
    }),
    service: new AdminUserManagementService(unitOfWork, {
      now: () => timestamp
    })
  });
}

function user(
  id: string,
  status: "active" | "suspended" | "archived",
  timestamp: Date
) {
  return {
    id,
    status,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
