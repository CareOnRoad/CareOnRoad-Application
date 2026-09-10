import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { ReminderWorker } from "@/server/workers/reminder.worker";

import { createReminderRouteHandlers } from "../reminder.route-handlers";
import { ReminderService } from "../reminder.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const reminderId = "66666666-6666-4666-8666-666666666666";
const now = new Date("2026-06-25T03:00:00Z");

describe("reminder routes", () => {
  it("asserts protected-route status mapping and valid owner success", async () => {
    const handlers = createHandlers();

    const missing = await handlers.listReminderRules(request("GET", "/api/v1/reminders"));
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });

    const invalidAuth = await handlers.listReminderRules(
      request("GET", "/api/v1/reminders", undefined, "invalid")
    );
    expect(invalidAuth.status).toBe(401);
    await expect(invalidAuth.json()).resolves.toMatchObject({ error_code: "INVALID_TOKEN" });

    const disallowed = await handlers.listReminderRules(
      request("GET", "/api/v1/reminders", undefined, "mechanic")
    );
    expect(disallowed.status).toBe(403);
    await expect(disallowed.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const invalidInput = await handlers.createReminderRule(
      request("POST", "/api/v1/reminders", { motorcycle_id: motorcycleId }, "rider")
    );
    expect(invalidInput.status).toBe(400);
    await expect(invalidInput.json()).resolves.toMatchObject({ error_code: "INVALID_INPUT" });

    const created = await handlers.createReminderRule(
      request(
        "POST",
        "/api/v1/reminders",
        {
          motorcycle_id: motorcycleId,
          title: "Bao duong",
          next_due_at: "2026-06-26T03:00:00.000Z",
          enabled: true
        },
        "rider"
      )
    );
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({ id: reminderId, rider_id: riderId });

    const nonOwner = await handlers.updateReminderRule(
      request(
        "PATCH",
        `/api/v1/reminders/${reminderId}`,
        {
          motorcycle_id: motorcycleId,
          title: "Khong phai chu",
          next_due_at: "2026-06-27T03:00:00.000Z",
          enabled: true
        },
        "other-rider"
      ),
      reminderId
    );
    expect(nonOwner.status).toBe(403);
    await expect(nonOwner.json()).resolves.toMatchObject({ error_code: "FORBIDDEN" });

    const absent = await handlers.updateReminderRule(
      request(
        "PATCH",
        "/api/v1/reminders/99999999-9999-4999-8999-999999999999",
        {
          motorcycle_id: motorcycleId,
          title: "Khong ton tai",
          next_due_at: "2026-06-27T03:00:00.000Z",
          enabled: true
        },
        "rider"
      ),
      "99999999-9999-4999-8999-999999999999"
    );
    expect(absent.status).toBe(404);
    await expect(absent.json()).resolves.toMatchObject({ error_code: "NOT_FOUND" });

    const snoozeInvalid = await handlers.snoozeReminderRule(
      request(
        "POST",
        `/api/v1/reminders/${reminderId}/snooze`,
        { until: "2026-06-24T03:00:00.000Z" },
        "rider"
      ),
      reminderId
    );
    expect(snoozeInvalid.status).toBe(400);
    await expect(snoozeInvalid.json()).resolves.toMatchObject({ error_code: "INVALID_INPUT" });

    const snoozed = await handlers.snoozeReminderRule(
      request(
        "POST",
        `/api/v1/reminders/${reminderId}/snooze`,
        { until: "2026-06-27T03:00:00.000Z" },
        "rider"
      ),
      reminderId
    );
    expect(snoozed.status).toBe(200);
    await expect(snoozed.json()).resolves.toMatchObject({
      snoozed_until: "2026-06-27T03:00:00.000Z"
    });

    const disabled = await handlers.disableReminderRule(
      request("DELETE", `/api/v1/reminders/${reminderId}`, undefined, "rider"),
      reminderId
    );
    expect(disabled.status).toBe(200);
    await expect(disabled.json()).resolves.toMatchObject({ enabled: false });
  });

  it("protects the reminder worker route with worker authority only", async () => {
    const handlers = createHandlers();
    const missing = await handlers.runReminderWorker(
      request("POST", "/api/v1/internal/workers/reminders/run")
    );
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });

    const invalid = await handlers.runReminderWorker(
      request("POST", "/api/v1/internal/workers/reminders/run", undefined, undefined, "bad-secret")
    );
    expect(invalid.status).toBe(401);
    await expect(invalid.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });

    const accepted = await handlers.runReminderWorker(
      request("POST", "/api/v1/internal/workers/reminders/run", undefined, undefined, "secret")
    );
    expect(accepted.status).toBe(202);
    await expect(accepted.json()).resolves.toMatchObject({ claimed: 0 });
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
  const ids = [
    reminderId,
    uuid(1),
    uuid(2),
    uuid(3),
    uuid(4),
    uuid(5),
    uuid(6),
    uuid(7)
  ];

  return createReminderRouteHandlers({
    authenticate,
    authenticateWorker: (request) => {
      if (request.headers.get("x-worker-secret") !== "secret") {
        const error = new Error("Worker authority is required.") as Error & {
          status: number;
          errorCode: "UNAUTHORIZED";
        };
        error.status = 401;
        error.errorCode = "UNAUTHORIZED";
        throw error;
      }
      return { workerId: "route-test-worker" };
    },
    reminderService: new ReminderService(unitOfWork, {
      now: () => now,
      createId: sequentialIds(ids)
    }),
    createWorker: (authority) =>
      new ReminderWorker(unitOfWork, {
        now: () => now,
        workerId: authority.workerId,
        createId: sequentialIds([uuid(20), uuid(21), uuid(22), uuid(23), uuid(24)])
      })
  });
}

function request(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  workerSecret?: string
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(workerSecret ? { "x-worker-secret": workerSecret } : {}),
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

function identity(subject: string): VerifiedSupabaseIdentity {
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

function uuid(index: number): string {
  return `${index.toString(16).padStart(8, "0")}-dddd-4ddd-8ddd-${index
    .toString(16)
    .padStart(12, "0")}`;
}
