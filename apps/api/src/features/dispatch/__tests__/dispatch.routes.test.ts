import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { createDispatchRouteHandlers } from "../dispatch.route-handlers";
import { DispatchService } from "../dispatch.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const otherMechanicId = "44444444-4444-4444-8444-444444444444";
const motorcycleId = "55555555-5555-4555-8555-555555555555";
const requestId = "66666666-6666-4666-8666-666666666666";
const absentId = "99999999-9999-4999-8999-999999999999";
const now = new Date("2026-06-25T05:00:00Z");

describe("dispatch routes", () => {
  it("asserts protected dispatch and offer route boundaries", async () => {
    const unitOfWork = createUnitOfWork();
    const handlers = createDispatchRouteHandlers({
      authenticate,
      dispatchService: new DispatchService(unitOfWork, {
        now: () => now,
        createId: sequentialIds([
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          "ffffffff-ffff-4fff-8fff-ffffffffffff",
          "99999999-9999-4999-8999-999999999999",
          "88888888-8888-4888-8888-888888888888",
          "77777777-7777-4777-8777-777777777777",
          ...Array.from({ length: 20 }, (_, index) => `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`)
        ])
      })
    });

    const missing = await handlers.startDispatch(request("POST", `/api/v1/service-requests/${requestId}/dispatch`), requestId);
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });

    const invalid = await handlers.startDispatch(
      request("POST", `/api/v1/service-requests/${requestId}/dispatch`, "invalid"),
      requestId
    );
    expect(invalid.status).toBe(401);
    await expect(invalid.json()).resolves.toMatchObject({ error_code: "INVALID_TOKEN" });

    const disallowed = await handlers.startDispatch(
      request("POST", `/api/v1/service-requests/${requestId}/dispatch`, "mechanic"),
      requestId
    );
    expect(disallowed.status).toBe(403);
    await expect(disallowed.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const nonOwner = await handlers.startDispatch(
      request("POST", `/api/v1/service-requests/${requestId}/dispatch`, "other-rider"),
      requestId
    );
    expect(nonOwner.status).toBe(403);
    await expect(nonOwner.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const absent = await handlers.startDispatch(
      request("POST", `/api/v1/service-requests/${absentId}/dispatch`, "rider"),
      absentId
    );
    expect(absent.status).toBe(404);
    await expect(absent.json()).resolves.toMatchObject({ error_code: "NOT_FOUND" });

    const started = await handlers.startDispatch(
      request("POST", `/api/v1/service-requests/${requestId}/dispatch`, "rider"),
      requestId
    );
    expect(started.status).toBe(202);
    const body = await started.json();
    expect(body).toMatchObject({ request_id: requestId, round_number: 1 });
    const offerId = body.candidates[0].id as string;

    const activeConflict = await handlers.startDispatch(
      request("POST", `/api/v1/service-requests/${requestId}/dispatch`, "rider"),
      requestId
    );
    expect(activeConflict.status).toBe(409);
    await expect(activeConflict.json()).resolves.toMatchObject({ error_code: "CONFLICT" });

    const offers = await handlers.listMyOffers(request("GET", "/api/v1/dispatch/offers", "mechanic"));
    expect(offers.status).toBe(200);
    await expect(offers.json()).resolves.toMatchObject({ items: [{ id: offerId }] });

    const nonCandidateDecline = await handlers.declineOffer(
      request("POST", `/api/v1/dispatch/offers/${offerId}/decline`, "other-mechanic"),
      offerId
    );
    expect(nonCandidateDecline.status).toBe(403);
    await expect(nonCandidateDecline.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const declined = await handlers.declineOffer(
      request("POST", `/api/v1/dispatch/offers/${offerId}/decline`, "mechanic"),
      offerId
    );
    expect(declined.status).toBe(204);
  });
});

function createUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [
      activeUser(riderId),
      activeUser(otherRiderId),
      activeUser(mechanicId),
      activeUser(otherMechanicId)
    ],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: otherRiderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" },
      { userId: otherMechanicId, role: "mechanic" }
    ],
    motorcycles: [
      {
        id: motorcycleId,
        riderId,
        brandText: "Honda",
        modelText: "Wave",
        createdAt: now,
        updatedAt: now
      }
    ],
    serviceRequests: [
      {
        id: requestId,
        requestCode: "COR-MOB-20260625-1",
        riderId,
        motorcycleId,
        serviceType: "mobile_repair",
        problemDescription: "Xe can ho tro",
        status: "submitted",
        priority: "normal",
        serviceLocation: { latitude: 10.762622, longitude: 106.660172 },
        createdAt: now,
        updatedAt: now
      }
    ],
    mechanicProfiles: [
      mechanic(mechanicId),
      mechanic(otherMechanicId)
    ]
  });
}

function request(method: string, path: string, token?: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
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
  return identity(
    token === "mechanic"
      ? mechanicId
      : token === "other-mechanic"
        ? otherMechanicId
        : token === "other-rider"
          ? otherRiderId
          : riderId
  );
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
  return { id, status: "active" as const, createdAt: now, updatedAt: now };
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://careonroad.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}

function mechanic(userId: string) {
  return {
    userId,
    profileStatus: "active" as const,
    isAvailable: true,
    serviceRadiusKm: 20,
    latestLocation: { latitude: 10.762622, longitude: 106.660172 },
    locationUpdatedAt: now,
    availabilityUpdatedAt: now,
    ratingAvg: userId === mechanicId ? 5 : 4,
    ratingCount: userId === mechanicId ? 2 : 0,
    serviceTypes: ["mobile_repair" as const],
    createdAt: now,
    updatedAt: now
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
