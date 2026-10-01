import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AcceptAssignmentService } from "../accept-assignment.service";
import { createAssignmentRouteHandlers } from "../assignment.route-handlers";
import { AssignmentService } from "../assignment.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const mechanicId = "22222222-2222-4222-8222-222222222222";
const otherMechanicId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const motorcycleId = "55555555-5555-4555-8555-555555555555";
const requestId = "66666666-6666-4666-8666-666666666666";
const offerId = "77777777-7777-4777-8777-777777777777";
const assignmentId = "88888888-8888-4888-8888-888888888888";
const absentId = "99999999-9999-4999-8999-999999999999";
const now = new Date("2026-06-25T05:00:00Z");

describe("assignment routes", () => {
  it("asserts offer accept, assignment list, and status route boundaries", async () => {
    const unitOfWork = createUnitOfWork();
    const handlers = createAssignmentRouteHandlers({
      authenticate,
      acceptService: new AcceptAssignmentService(unitOfWork, {
        now: () => now,
        createId: sequentialIds([
          assignmentId,
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
        ])
      }),
      assignmentService: new AssignmentService(unitOfWork, {
        now: () => now,
        createId: sequentialIds([
          "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          "ffffffff-ffff-4fff-8fff-ffffffffffff",
          "aaaaaaaa-0000-4000-8000-000000000001",
          "aaaaaaaa-0000-4000-8000-000000000002",
          "aaaaaaaa-0000-4000-8000-000000000003",
          "aaaaaaaa-0000-4000-8000-000000000004",
          "aaaaaaaa-0000-4000-8000-000000000005",
          "aaaaaaaa-0000-4000-8000-000000000006"
        ])
      })
    });

    const missing = await handlers.acceptOffer(
      request("POST", `/api/v1/dispatch/offers/${offerId}/accept`),
      offerId
    );
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });

    const invalid = await handlers.acceptOffer(
      request("POST", `/api/v1/dispatch/offers/${offerId}/accept`, "invalid"),
      offerId
    );
    expect(invalid.status).toBe(401);
    await expect(invalid.json()).resolves.toMatchObject({ error_code: "INVALID_TOKEN" });

    const disallowedRole = await handlers.acceptOffer(
      request("POST", `/api/v1/dispatch/offers/${offerId}/accept`, "rider"),
      offerId
    );
    expect(disallowedRole.status).toBe(403);
    await expect(disallowedRole.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const nonCandidate = await handlers.acceptOffer(
      request("POST", `/api/v1/dispatch/offers/${offerId}/accept`, "other-mechanic"),
      offerId
    );
    expect(nonCandidate.status).toBe(403);
    await expect(nonCandidate.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const absent = await handlers.acceptOffer(
      request("POST", `/api/v1/dispatch/offers/${absentId}/accept`, "mechanic"),
      absentId
    );
    expect(absent.status).toBe(404);
    await expect(absent.json()).resolves.toMatchObject({ error_code: "NOT_FOUND" });

    const accepted = await handlers.acceptOffer(
      request("POST", `/api/v1/dispatch/offers/${offerId}/accept`, "mechanic"),
      offerId
    );
    expect(accepted.status).toBe(201);
    await expect(accepted.json()).resolves.toMatchObject({ id: assignmentId, status: "accepted" });

    const list = await handlers.listAssignments(request("GET", "/api/v1/assignments", "mechanic"));
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({ items: [{ id: assignmentId }] });

    const unassignedStatus = await handlers.transitionAssignment(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/status`, "other-mechanic", {
        status: "en_route"
      }),
      assignmentId
    );
    expect(unassignedStatus.status).toBe(403);
    await expect(unassignedStatus.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const absentStatus = await handlers.transitionAssignment(
      jsonRequest("POST", `/api/v1/assignments/${absentId}/status`, "mechanic", {
        status: "en_route"
      }),
      absentId
    );
    expect(absentStatus.status).toBe(404);
    await expect(absentStatus.json()).resolves.toMatchObject({ error_code: "NOT_FOUND" });

    const transitioned = await handlers.transitionAssignment(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/status`, "mechanic", {
        status: "en_route"
      }),
      assignmentId
    );
    expect(transitioned.status).toBe(200);
    await expect(transitioned.json()).resolves.toMatchObject({ status: "en_route" });

    const adminTransition = await handlers.transitionAssignment(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/status`, "admin", {
        status: "on_site"
      }),
      assignmentId
    );
    expect(adminTransition.status).toBe(200);
    await expect(adminTransition.json()).resolves.toMatchObject({ status: "on_site" });

    const invalidTransition = await handlers.transitionAssignment(
      jsonRequest("POST", `/api/v1/assignments/${assignmentId}/status`, "mechanic", {
        status: "accepted"
      }),
      assignmentId
    );
    expect(invalidTransition.status).toBe(409);
    await expect(invalidTransition.json()).resolves.toMatchObject({ error_code: "CONFLICT" });
  });
});

function createUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [
      activeUser(riderId),
      activeUser(mechanicId),
      activeUser(otherMechanicId),
      activeUser(adminId)
    ],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" },
      { userId: otherMechanicId, role: "mechanic" },
      { userId: adminId, role: "admin" }
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
        status: "offered",
        priority: "normal",
        serviceLocation: { latitude: 10.762622, longitude: 106.660172 },
        createdAt: now,
        updatedAt: now
      }
    ],
    mechanicProfiles: [mechanic(mechanicId), mechanic(otherMechanicId)],
    dispatchRounds: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requestId,
        roundNumber: 1,
        radiusMeters: 2000,
        status: "active",
        startedAt: now,
        expiresAt: new Date(now.getTime() + 60_000)
      }
    ],
    dispatchCandidates: [
      {
        id: offerId,
        roundId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requestId,
        mechanicId,
        rank: 1,
        distanceMeters: 20,
        status: "offered",
        offeredAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
        createdAt: now
      }
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

function jsonRequest(method: string, path: string, token: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
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
        : token === "admin"
          ? adminId
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

function mechanic(userId: string) {
  return {
    userId,
    profileStatus: "active" as const,
    isAvailable: true,
    serviceRadiusKm: 20,
    latestLocation: { latitude: 10.762622, longitude: 106.660172 },
    locationUpdatedAt: now,
    availabilityUpdatedAt: now,
    ratingAvg: 4,
    ratingCount: 1,
    serviceTypes: ["mobile_repair" as const],
    createdAt: now,
    updatedAt: now
  };
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://careonroad.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
}

function sequentialIds(ids: string[]): () => string {
  let extraId = 1000;
  return () => {
    const id = ids.shift() ?? `aaaaaaaa-0000-4000-8000-${String(extraId++).padStart(12, "0")}`;
    if (!id) {
      throw new Error("Test ID sequence exhausted.");
    }
    return id;
  };
}
