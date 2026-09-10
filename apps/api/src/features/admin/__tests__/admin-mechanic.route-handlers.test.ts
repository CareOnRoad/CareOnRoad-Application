import { describe, expect, it, vi } from "vitest";

import { AuthError } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AdminMechanicManagementService } from "../admin-mechanic-management.service";
import { createAdminMechanicRouteHandlers } from "../admin-mechanic.route-handlers";
import {
  adminIdentity,
  ADMIN_USER_ID,
  createAdminRequest,
  expectApiError,
  RIDER_USER_ID
} from "./admin-route-test-helpers";

const PENDING_ID = "33333333-3333-4333-8333-333333333333";
const ACTIVE_ID = "44444444-4444-4444-8444-444444444444";
const REJECT_ID = "55555555-5555-4555-8555-555555555555";
const timestamp = new Date("2026-07-06T03:00:00.000Z");
const reason = { reason: "Approved mechanic administrative operation" };

describe("admin mechanic route handlers", () => {
  it("enforces authentication and active-admin authorization", async () => {
    const handlers = createHandlers();
    await expectApiError(
      await handlers.listMechanics(createAdminRequest("/api/v1/admin/mechanics")),
      401,
      "UNAUTHORIZED"
    );
    await expectApiError(
      await createHandlers(RIDER_USER_ID).listMechanics(
        createAdminRequest("/api/v1/admin/mechanics", { token: "valid-token" })
      ),
      403,
      "FORBIDDEN"
    );
  });

  it("returns stable validation errors for bad filters and commands", async () => {
    const handlers = createHandlers();
    await expectApiError(
      await handlers.listMechanics(
        request("/api/v1/admin/mechanics?profile_status=unknown")
      ),
      400,
      "INVALID_INPUT"
    );
    await expectApiError(
      await handlers.approve(
        createAdminRequest(`/api/v1/admin/mechanics/${PENDING_ID}/approve`, {
          method: "POST",
          token: "valid-token",
          body: reason
        }),
        PENDING_ID
      ),
      400,
      "INVALID_INPUT"
    );
    await expectApiError(
      await handlers.getMechanic(
        request("/api/v1/admin/mechanics/not-a-uuid"),
        "not-a-uuid"
      ),
      400,
      "INVALID_INPUT"
    );
  });

  it("exposes every Patch C route operation without rating setters", async () => {
    const handlers = createHandlers();
    const list = await (
      await handlers.listMechanics(
        request(
          "/api/v1/admin/mechanics?profile_status=active&is_available=true&limit=10"
        )
      )
    ).json();
    expect(list.items).toEqual([
      expect.objectContaining({ user_id: ACTIVE_ID, rating_avg: 4.5 })
    ]);
    expect(
      await (
        await handlers.getMechanic(
          request(`/api/v1/admin/mechanics/${ACTIVE_ID}`),
          ACTIVE_ID
        )
      ).json()
    ).toMatchObject({ user_id: ACTIVE_ID, rating_count: 12 });

    expect(
      (
        await handlers.approve(
          command("approve", PENDING_ID, reason, "approve-route-key"),
          PENDING_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.reject(
          command("reject", REJECT_ID, reason, "reject-route-key"),
          REJECT_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.updateSkills(
          command(
            "skills",
            ACTIVE_ID,
            { ...reason, service_types: ["emergency_rescue"] },
            "skills-route-key",
            "PUT"
          ),
          ACTIVE_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.updateRadius(
          command(
            "service-radius",
            ACTIVE_ID,
            { ...reason, service_radius_km: 25 },
            "radius-route-key",
            "PUT"
          ),
          ACTIVE_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.forceUnavailable(
          command(
            "force-unavailable",
            ACTIVE_ID,
            reason,
            "availability-route-key"
          ),
          ACTIVE_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.suspend(
          command("suspend", ACTIVE_ID, reason, "suspend-route-key"),
          ACTIVE_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.reactivate(
          command("reactivate", ACTIVE_ID, reason, "reactivate-route-key"),
          ACTIVE_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.ban(
          command("ban", ACTIVE_ID, reason, "ban-route-key"),
          ACTIVE_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.listWorkHistory(
          request(`/api/v1/admin/mechanics/${ACTIVE_ID}/work-history?limit=10`),
          ACTIVE_ID
        )
      ).status
    ).toBe(200);
    expect(
      (
        await handlers.getPerformance(
          request(`/api/v1/admin/mechanics/${ACTIVE_ID}/performance`),
          ACTIVE_ID
        )
      ).status
    ).toBe(200);

    const serialized = JSON.stringify(
      await (
        await handlers.getPerformance(
          request(`/api/v1/admin/mechanics/${ACTIVE_ID}/performance`),
          ACTIVE_ID
        )
      ).json()
    );
    expect(serialized).not.toMatch(/set_rating|update_rating/);
  });
});

function createHandlers(subject = ADMIN_USER_ID) {
  const unitOfWork = new InMemoryUnitOfWork({
    users: [
      user(ADMIN_USER_ID),
      user(RIDER_USER_ID),
      user(PENDING_ID),
      user(ACTIVE_ID),
      user(REJECT_ID)
    ],
    userRoles: [
      { userId: ADMIN_USER_ID, role: "admin" },
      { userId: RIDER_USER_ID, role: "rider" },
      { userId: PENDING_ID, role: "mechanic" },
      { userId: ACTIVE_ID, role: "mechanic" },
      { userId: REJECT_ID, role: "mechanic" }
    ],
    mechanicProfiles: [
      profile(PENDING_ID, "pending", false, 0, 0),
      profile(ACTIVE_ID, "active", true, 4.5, 12),
      profile(REJECT_ID, "pending", false, 0, 0)
    ]
  });
  return createAdminMechanicRouteHandlers({
    authenticate: vi.fn(async (requestValue: Request) => {
      if (!requestValue.headers.has("authorization")) {
        throw new AuthError("UNAUTHORIZED", "Authentication is required.", 401);
      }
      return { ...adminIdentity, subject };
    }),
    service: new AdminMechanicManagementService(unitOfWork, {
      now: () => timestamp
    })
  });
}

function request(path: string) {
  return createAdminRequest(path, { token: "valid-token" });
}

function command(
  action: string,
  mechanicId: string,
  body: unknown,
  idempotencyKey: string,
  method = "POST"
) {
  return createAdminRequest(
    `/api/v1/admin/mechanics/${mechanicId}/${action}`,
    { method, token: "valid-token", body, idempotencyKey }
  );
}

function user(id: string) {
  return {
    id,
    status: "active" as const,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function profile(
  userId: string,
  profileStatus: "pending" | "active",
  isAvailable: boolean,
  ratingAvg: number,
  ratingCount: number
) {
  return {
    userId,
    profileStatus,
    isAvailable,
    serviceRadiusKm: 10,
    latestLocation: { latitude: 10.75, longitude: 106.67 },
    locationUpdatedAt: timestamp,
    availabilityUpdatedAt: timestamp,
    ratingAvg,
    ratingCount,
    serviceTypes: ["mobile_repair" as const],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
