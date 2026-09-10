import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import type { VerifiedSupabaseIdentity } from "../../auth/auth.types";
import { MechanicProfileService } from "../mechanic-profile.service";
import { createMotorcycleRouteHandlers } from "../motorcycle.route-handlers";
import { MotorcycleService } from "../motorcycle.service";

const mechanicId = "11111111-1111-4111-8111-111111111111";
const riderId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-06-25T06:00:00Z");

describe("mechanic profile routes", () => {
  it("asserts exact protected-route status mapping and valid mechanic success", async () => {
    const unitOfWork = createMechanicUnitOfWork();
    const handlers = createHandlers(unitOfWork);

    const missing = await handlers.getMyMechanicProfile(
      request("GET", "/api/v1/mechanics/me/profile")
    );
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });

    const invalidAuth = await handlers.getMyMechanicProfile(
      request("GET", "/api/v1/mechanics/me/profile", undefined, "invalid")
    );
    expect(invalidAuth.status).toBe(401);
    await expect(invalidAuth.json()).resolves.toMatchObject({ error_code: "INVALID_TOKEN" });

    const disallowed = await handlers.getMyMechanicProfile(
      request("GET", "/api/v1/mechanics/me/profile", undefined, "rider")
    );
    expect(disallowed.status).toBe(403);
    await expect(disallowed.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const validRead = await handlers.getMyMechanicProfile(
      request("GET", "/api/v1/mechanics/me/profile", undefined, "mechanic")
    );
    expect(validRead.status).toBe(200);
    await expect(validRead.json()).resolves.toMatchObject({
      user_id: mechanicId,
      rating_avg: 0,
      rating_count: 0
    });

    const invalidInput = await handlers.updateMyMechanicProfile(
      request("PATCH", "/api/v1/mechanics/me/profile", { rating_avg: 5 }, "mechanic")
    );
    expect(invalidInput.status).toBe(400);
    await expect(invalidInput.json()).resolves.toMatchObject({ error_code: "INVALID_INPUT" });

    const updatedProfile = await handlers.updateMyMechanicProfile(
      request(
        "PATCH",
        "/api/v1/mechanics/me/profile",
        { service_radius_km: 10, service_types: ["mobile_repair", "emergency_rescue"] },
        "mechanic"
      )
    );
    expect(updatedProfile.status).toBe(200);
    await expect(updatedProfile.json()).resolves.toMatchObject({
      service_radius_km: 10,
      service_types: ["emergency_rescue", "mobile_repair"]
    });

    const updatedAvailability = await handlers.updateMechanicAvailability(
      request("PUT", "/api/v1/mechanics/me/availability", { is_available: true }, "mechanic")
    );
    expect(updatedAvailability.status).toBe(200);
    await expect(updatedAvailability.json()).resolves.toMatchObject({
      is_available: true,
      availability_updated_at: now.toISOString()
    });

    const updatedLocation = await handlers.updateMechanicLocation(
      request(
        "PUT",
        "/api/v1/mechanics/me/location",
        { latitude: 10.75, longitude: 106.67 },
        "mechanic"
      )
    );
    expect(updatedLocation.status).toBe(204);
  });

  it("returns 404 when a mechanic profile is absent", async () => {
    const handlers = createHandlers(createMechanicUnitOfWork({ includeProfile: false }));
    const response = await handlers.getMyMechanicProfile(
      request("GET", "/api/v1/mechanics/me/profile", undefined, "mechanic")
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error_code: "NOT_FOUND" });
  });
});

function createHandlers(unitOfWork: InMemoryUnitOfWork) {
  return createMotorcycleRouteHandlers({
    authenticate,
    motorcycleService: new MotorcycleService(unitOfWork),
    mechanicProfileService: new MechanicProfileService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        "66666666-6666-4666-8666-666666666666",
        "77777777-7777-4777-8777-777777777777",
        "88888888-8888-4888-8888-888888888888"
      ])
    })
  });
}

function createMechanicUnitOfWork(options: { includeProfile?: boolean } = {}) {
  const includeProfile = options.includeProfile ?? true;
  return new InMemoryUnitOfWork({
    users: [activeUser(mechanicId), activeUser(riderId)],
    userRoles: [
      { userId: mechanicId, role: "mechanic" },
      { userId: riderId, role: "rider" }
    ],
    mechanicProfiles: includeProfile
      ? [
          {
            userId: mechanicId,
            profileStatus: "active",
            isAvailable: false,
            serviceRadiusKm: 5,
            availabilityUpdatedAt: new Date("2026-06-25T00:00:00Z"),
            ratingAvg: 0,
            ratingCount: 0,
            serviceTypes: ["mobile_repair"],
            createdAt: new Date("2026-06-25T00:00:00Z"),
            updatedAt: new Date("2026-06-25T00:00:00Z")
          }
        ]
      : []
  });
}

function request(method: string, path: string, body?: unknown, token?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function authenticate(request: Request): Promise<VerifiedSupabaseIdentity> {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    throw routeAuthError("UNAUTHORIZED", "Authentication is required.");
  }
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (token === "invalid") {
    throw routeAuthError("INVALID_TOKEN", "Authentication token is invalid.");
  }
  return identity(token === "rider" ? riderId : mechanicId);
}

function routeAuthError(errorCode: "UNAUTHORIZED" | "INVALID_TOKEN", message: string) {
  const error = new Error(message) as Error & {
    status: number;
    errorCode: "UNAUTHORIZED" | "INVALID_TOKEN";
  };
  error.status = 401;
  error.errorCode = errorCode;
  return error;
}

function activeUser(id: string) {
  return {
    id,
    status: "active" as const,
    createdAt: now,
    updatedAt: now
  };
}

function identity(subject: string) {
  return {
    subject,
    issuer: "https://careonroad.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}

function sequentialIds(ids: string[]): () => string {
  return () => {
    const id = ids.shift();
    if (!id) {
      throw new Error("Test ID sequence exhausted.");
    }
    return id;
  };
}
