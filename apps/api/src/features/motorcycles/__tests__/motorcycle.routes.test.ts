import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import type { VerifiedSupabaseIdentity } from "../../auth/auth.types";
import { MechanicProfileService } from "../mechanic-profile.service";
import { createMotorcycleRouteHandlers } from "../motorcycle.route-handlers";
import { MotorcycleService } from "../motorcycle.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-06-25T05:00:00Z");

describe("motorcycle routes", () => {
  it("asserts exact protected-route status mapping and valid owner success", async () => {
    const unitOfWork = createMotorcycleUnitOfWork();
    const handlers = createHandlers(unitOfWork);

    const missing = await handlers.listMotorcycles(request("GET", "/api/v1/motorcycles"));
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });

    const invalidAuth = await handlers.listMotorcycles(
      request("GET", "/api/v1/motorcycles", undefined, "invalid")
    );
    expect(invalidAuth.status).toBe(401);
    await expect(invalidAuth.json()).resolves.toMatchObject({ error_code: "INVALID_TOKEN" });

    const disallowed = await handlers.listMotorcycles(
      request("GET", "/api/v1/motorcycles", undefined, "mechanic")
    );
    expect(disallowed.status).toBe(403);
    await expect(disallowed.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const invalidInput = await handlers.createMotorcycle(
      request("POST", "/api/v1/motorcycles", { brand_text: "", model_text: "Wave" }, "rider")
    );
    expect(invalidInput.status).toBe(400);
    await expect(invalidInput.json()).resolves.toMatchObject({ error_code: "INVALID_INPUT" });

    const created = await handlers.createMotorcycle(
      request(
        "POST",
        "/api/v1/motorcycles",
        { brand_text: "Honda", model_text: "Wave" },
        "rider"
      )
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody).toMatchObject({
      id: motorcycleId,
      rider_id: riderId
    });
    // Maintenance fields are omitted when no service request / reminder history exists.
    expect(createdBody.last_maintenance_at).toBeUndefined();
    expect(createdBody.next_maintenance_at).toBeUndefined();

    const nonOwner = await handlers.getMotorcycle(
      request("GET", `/api/v1/motorcycles/${motorcycleId}`, undefined, "other-rider"),
      motorcycleId
    );
    expect(nonOwner.status).toBe(403);
    await expect(nonOwner.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const absent = await handlers.getMotorcycle(
      request(
        "GET",
        "/api/v1/motorcycles/99999999-9999-4999-8999-999999999999",
        undefined,
        "rider"
      ),
      "99999999-9999-4999-8999-999999999999"
    );
    expect(absent.status).toBe(404);
    await expect(absent.json()).resolves.toMatchObject({ error_code: "NOT_FOUND" });

    const updated = await handlers.updateMotorcycle(
      request(
        "PATCH",
        `/api/v1/motorcycles/${motorcycleId}`,
        { brand_text: "Honda", model_text: "Future" },
        "rider"
      ),
      motorcycleId
    );
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({ model_text: "Future" });

    const archived = await handlers.archiveMotorcycle(
      request("DELETE", `/api/v1/motorcycles/${motorcycleId}`, undefined, "rider"),
      motorcycleId
    );
    expect(archived.status).toBe(204);
  });

  it("does not require X-Idempotency-Key for motorcycle mutations", async () => {
    const handlers = createHandlers(createMotorcycleUnitOfWork());
    const response = await handlers.createMotorcycle(
      request(
        "POST",
        "/api/v1/motorcycles",
        { brand_text: "Yamaha", model_text: "Sirius" },
        "rider"
      )
    );

    expect(response.status).toBe(201);
  });
});

function createHandlers(unitOfWork: InMemoryUnitOfWork) {
  return createMotorcycleRouteHandlers({
    authenticate,
    motorcycleService: new MotorcycleService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        motorcycleId,
        "55555555-5555-4555-8555-555555555555",
        "66666666-6666-4666-8666-666666666666",
        "77777777-7777-4777-8777-777777777777",
        "88888888-8888-4888-8888-888888888888",
        "99999999-9999-4999-8999-999999999999",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      ])
    }),
    mechanicProfileService: new MechanicProfileService(unitOfWork)
  });
}

function createMotorcycleUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [activeUser(riderId), activeUser(otherRiderId), activeUser(mechanicId)],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: otherRiderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" }
    ]
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
