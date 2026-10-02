import { describe, expect, it, vi } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AuthService } from "../auth.service";
import type { VerifiedSupabaseIdentity } from "../auth.types";
import type { RequestActor } from "../auth.types";
import { createAuthRouteHandlers } from "../auth.route-handlers";

const identity: VerifiedSupabaseIdentity = {
  subject: "11111111-1111-4111-8111-111111111111",
  issuer: "https://careonroad.supabase.co/auth/v1",
  audience: ["authenticated"]
};
const actor: RequestActor = {
  id: identity.subject,
  display_name: "Rider",
  roles: ["rider"],
  status: "active"
};
const device = {
  id: "33333333-3333-4333-8333-333333333333",
  platform: "android",
  enabled: true,
  last_registered_at: "2026-06-25T01:00:00.000Z",
  push_token_registered: false
};

describe("auth routes", () => {
  it("PATCH changes only the authenticated profile, rejects injection, and leaves POST bootstrap unchanged", async () => {
    const uow = new InMemoryUnitOfWork(); const service = new AuthService(uow);
    await service.bootstrapProfile(identity, { display_name: "Original" });
    const handlers = createAuthRouteHandlers({ authenticate: async () => identity, authService: service });
    const patch = (body: unknown) => handlers.updateProfile(new Request("http://localhost/api/v1/auth/profile", {
      method: "PATCH", body: JSON.stringify(body)
    }));
    expect((await patch({ display_name: " Updated " })).status).toBe(200);
    expect(await service.bootstrapProfile(identity, { display_name: "Ignored" })).toMatchObject({ display_name: "Updated" });
    for (const field of ["id", "user_id", "roles", "status", "account_type", "rating", "verified"]) {
      expect((await patch({ display_name: "Injected", [field]: field === "roles" ? ["admin"] : "anything" })).status).toBe(400);
    }
    const state = uow.snapshot();
    expect(state.auditLogs.at(-1)?.metadata).toEqual({ field: "display_name" });
    expect(JSON.stringify(state.auditLogs)).not.toContain("Updated");
    expect(state.outboxEvents).toHaveLength(1);
    await expect(service.updateProfile({ ...identity, subject: "22222222-2222-4222-8222-222222222222" }, { display_name: "Other" }))
      .rejects.toMatchObject({ status: 404 });
    state.users[0]!.status = "suspended";
    await expect(new AuthService(new InMemoryUnitOfWork(state)).updateProfile(identity, { display_name: "Blocked" }))
      .rejects.toMatchObject({ status: 403 });
  });
  it("returns the current actor for GET /api/v1/auth/me", async () => {
    const handlers = createHandlers();
    const response = await handlers.getMe(
      new Request("http://localhost/api/v1/auth/me", {
        headers: { authorization: "Bearer valid-token" }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(actor);
  });

  it("bootstraps a profile for POST /api/v1/auth/profile", async () => {
    const handlers = createHandlers();
    const response = await handlers.bootstrapProfile(
      new Request("http://localhost/api/v1/auth/profile", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({ display_name: "Rider" })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(actor);
  });

  it("accepts rider or mechanic account selection but rejects admin self-registration", async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const handlers = createAuthRouteHandlers({
      authenticate: vi.fn(async () => identity),
      authService: new AuthService(unitOfWork)
    });
    const mechanic = await handlers.bootstrapProfile(
      new Request("http://localhost/api/v1/auth/profile", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({ account_type: "mechanic" })
      })
    );
    const admin = await handlers.bootstrapProfile(
      new Request("http://localhost/api/v1/auth/profile", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({ account_type: "admin" })
      })
    );

    expect(mechanic.status).toBe(200);
    await expect(mechanic.json()).resolves.toMatchObject({ roles: ["mechanic"] });
    expect(unitOfWork.snapshot().mechanicProfiles[0]).toMatchObject({
      profileStatus: "pending",
      isAvailable: false
    });
    expect(admin.status).toBe(400);
    await expect(admin.json()).resolves.toMatchObject({ error_code: "INVALID_INPUT" });
  });

  it("returns controlled errors for missing authentication and invalid input", async () => {
    const handlers = createHandlers();
    const unauthorized = await handlers.getMe(new Request("http://localhost/api/v1/auth/me"));
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });

    const invalid = await handlers.bootstrapProfile(
      new Request("http://localhost/api/v1/auth/profile", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({ display_name: "" })
      })
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error_code: "INVALID_INPUT" });
  });

  it("registers validated device metadata for POST /api/v1/auth/devices", async () => {
    const handlers = createHandlers();
    const response = await handlers.registerDevice(
      new Request("http://localhost/api/v1/auth/devices", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          device_key: "private-device-token-123456",
          platform: "android"
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(device);
  });

  it("rejects invalid device registration input", async () => {
    const handlers = createHandlers();
    const response = await handlers.registerDevice(
      new Request("http://localhost/api/v1/auth/devices", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({ device_key: "short", platform: "" })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error_code: "INVALID_INPUT" });
  });

  it("rotates and revokes an owned push token with redacted responses", async () => {
    const handlers = createHandlers();
    const raw = "private-provider-token-route-123456";
    const rotated = await handlers.rotatePushToken(
      new Request("http://localhost/api/v1/auth/devices/device/push-token", {
        method: "PUT",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({ push_provider: "fcm", push_token: raw })
      }),
      device.id
    );
    const revoked = await handlers.revokePushToken(
      new Request("http://localhost/api/v1/auth/devices/device/push-token", {
        method: "DELETE",
        headers: { authorization: "Bearer valid-token" }
      }),
      device.id
    );

    expect(rotated.status).toBe(200);
    expect(revoked.status).toBe(200);
    expect(await rotated.text()).not.toContain(raw);
    expect(await revoked.text()).not.toContain(raw);
  });

  it("requires paired provider/token fields during device registration", async () => {
    const handlers = createHandlers();
    const response = await handlers.registerDevice(
      new Request("http://localhost/api/v1/auth/devices", {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          device_key: "stable-installation-key-123456",
          platform: "android",
          push_token: "private-provider-token-route-123456"
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error_code: "INVALID_INPUT" });
  });
});

function createHandlers() {
  return createAuthRouteHandlers({
    authenticate: vi.fn(async (request: Request) => {
      if (!request.headers.get("authorization")) {
        const error = new Error("Authentication is required.") as Error & {
          status: number;
          errorCode: "UNAUTHORIZED";
        };
        error.status = 401;
        error.errorCode = "UNAUTHORIZED";
        throw error;
      }
      return identity;
    }),
    authService: {
      getCurrentActor: vi.fn(async () => actor),
      bootstrapProfile: vi.fn(async () => actor),
      registerDevice: vi.fn(async () => device),
      rotatePushToken: vi.fn(async () => device),
      revokePushToken: vi.fn(async () => device)
    }
  });
}
