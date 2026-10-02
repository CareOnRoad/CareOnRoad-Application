import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import type { VerifiedSupabaseIdentity } from "../../auth/auth.types";
import { createServiceRequestRouteHandlers } from "../service-request.route-handlers";
import { ServiceRequestService } from "../service-request.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const requestId = "66666666-6666-4666-8666-666666666666";
const now = new Date("2026-06-25T05:00:00Z");

describe("service request routes", () => {
  it("asserts exact protected-route status mapping and valid owner success", async () => {
    const handlers = createHandlers();

    const missing = await handlers.listServiceRequests(request("GET", "/api/v1/service-requests"));
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });

    const invalidAuth = await handlers.listServiceRequests(
      request("GET", "/api/v1/service-requests", undefined, "invalid")
    );
    expect(invalidAuth.status).toBe(401);
    await expect(invalidAuth.json()).resolves.toMatchObject({ error_code: "INVALID_TOKEN" });

    const disallowed = await handlers.listServiceRequests(
      request("GET", "/api/v1/service-requests", undefined, "mechanic")
    );
    expect(disallowed.status).toBe(403);
    await expect(disallowed.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const missingIdempotency = await handlers.createServiceRequest(
      request(
        "POST",
        "/api/v1/service-requests",
        {
          motorcycle_id: motorcycleId,
          service_type: "mobile_repair",
          problem_description: "Xe tat may",
          location: { latitude: 10.77, longitude: 106.69 }, address_text: "1 Nguyen Trai"
        },
        "rider"
      )
    );
    expect(missingIdempotency.status).toBe(400);
    await expect(missingIdempotency.json()).resolves.toMatchObject({
      error_code: "INVALID_INPUT"
    });

    const invalidInput = await handlers.createServiceRequest(
      request(
        "POST",
        "/api/v1/service-requests",
        {
          motorcycle_id: motorcycleId,
          service_type: "periodic_maintenance",
          problem_description: "Bao duong"
        },
        "rider",
        "invalid-input-key"
      )
    );
    expect(invalidInput.status).toBe(400);
    await expect(invalidInput.json()).resolves.toMatchObject({ error_code: "INVALID_INPUT" });

    const created = await handlers.createServiceRequest(
      request(
        "POST",
        "/api/v1/service-requests",
        {
          motorcycle_id: motorcycleId,
          service_type: "mobile_repair",
          problem_description: "Xe tat may",
          location: { latitude: 10.77, longitude: 106.69 }, address_text: "1 Nguyen Trai"
        },
        "rider",
        "create-key"
      )
    );
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({ id: requestId, rider_id: riderId });

    const mismatch = await handlers.createServiceRequest(
      request(
        "POST",
        "/api/v1/service-requests",
        {
          motorcycle_id: motorcycleId,
          service_type: "mobile_repair",
          problem_description: "Noi dung khac",
          location: { latitude: 10.77, longitude: 106.69 }, address_text: "1 Nguyen Trai"
        },
        "rider",
        "create-key"
      )
    );
    expect(mismatch.status).toBe(409);
    await expect(mismatch.json()).resolves.toMatchObject({ error_code: "CONFLICT" });

    const nonOwner = await handlers.getServiceRequest(
      request("GET", `/api/v1/service-requests/${requestId}`, undefined, "other-rider"),
      requestId
    );
    expect(nonOwner.status).toBe(403);
    await expect(nonOwner.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const absent = await handlers.getServiceRequest(
      request(
        "GET",
        "/api/v1/service-requests/99999999-9999-4999-8999-999999999999",
        undefined,
        "rider"
      ),
      "99999999-9999-4999-8999-999999999999"
    );
    expect(absent.status).toBe(404);
    await expect(absent.json()).resolves.toMatchObject({ error_code: "NOT_FOUND" });

    const media = await handlers.addMediaMetadata(
      request(
        "POST",
        `/api/v1/service-requests/${requestId}/media`,
        { media_type: "image", object_reference: "requests/one.jpg", content_type: "image/jpeg" },
        "rider"
      ),
      requestId
    );
    expect(media.status).toBe(201);

    const canceled = await handlers.cancelServiceRequest(
      request(
        "POST",
        `/api/v1/service-requests/${requestId}/cancel`,
        { reason: "Khong can nua" },
        "rider"
      ),
      requestId
    );
    expect(canceled.status).toBe(200);
    await expect(canceled.json()).resolves.toMatchObject({ status: "canceled" });

    const stateConflict = await handlers.cancelServiceRequest(
      request(
        "POST",
        `/api/v1/service-requests/${requestId}/cancel`,
        { reason: "Huy tiep" },
        "rider"
      ),
      requestId
    );
    expect(stateConflict.status).toBe(409);
    await expect(stateConflict.json()).resolves.toMatchObject({ error_code: "CONFLICT" });
  });
});

function createHandlers() {
  const unitOfWork = new InMemoryUnitOfWork({
    users: [activeUser(riderId), activeUser(otherRiderId), activeUser(mechanicId)],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: otherRiderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" }
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
    ]
  });

  return createServiceRequestRouteHandlers({
    authenticate,
    serviceRequestService: new ServiceRequestService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requestId,
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        "ffffffff-ffff-4fff-8fff-ffffffffffff",
        "99999999-9999-4999-8999-999999999999",
        "88888888-8888-4888-8888-888888888888",
        "77777777-7777-4777-8777-777777777777",
        "66666666-1111-4666-8666-666666666666",
        "55555555-1111-4555-8555-555555555555",
        "44444444-1111-4444-8444-444444444444"
      ])
    })
  });
}

function request(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  idempotencyKey?: string
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
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
  return identity(
    token === "mechanic" ? mechanicId : token === "other-rider" ? otherRiderId : riderId
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
