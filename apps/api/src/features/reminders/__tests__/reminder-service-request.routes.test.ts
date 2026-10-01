import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { createServiceRequestRouteHandlers } from "@/features/service-requests/service-request.route-handlers";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

const riderId = "11111111-1111-4111-8111-111111111111";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const reminderId = "66666666-6666-4666-8666-666666666666";
const occurrenceId = "77777777-7777-4777-8777-777777777777";
const requestId = "88888888-8888-4888-8888-888888888888";
const now = new Date("2026-06-25T03:00:00Z");

describe("reminder-originated service request route behavior", () => {
  it("uses the existing service-request route for due reminder context and conflicts", async () => {
    const handlers = createHandlers();
    const created = await handlers.createServiceRequest(
      request(
        {
          motorcycle_id: motorcycleId,
          service_type: "periodic_maintenance",
          location: { latitude: 10.77, longitude: 106.69 },
          problem_description: "Bao duong tu reminder",
          reminder_id: reminderId,
          reminder_context_id: occurrenceId
        },
        "rider",
        "route-reminder-key"
      )
    );
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      id: requestId,
      status: "submitted",
      reminder_id: reminderId,
      reminder_context_id: occurrenceId
    });

    const stateConflict = await handlers.createServiceRequest(
      request(
        {
          motorcycle_id: motorcycleId,
          service_type: "periodic_maintenance",
          location: { latitude: 10.77, longitude: 106.69 },
          problem_description: "Bao duong tu reminder",
          reminder_id: reminderId,
          reminder_context_id: occurrenceId
        },
        "rider",
        "route-reminder-second-key"
      )
    );
    expect(stateConflict.status).toBe(409);
    await expect(stateConflict.json()).resolves.toMatchObject({ error_code: "CONFLICT" });
  });
});

function createHandlers() {
  const unitOfWork = new InMemoryUnitOfWork({
    users: [activeUser(riderId)],
    userRoles: [{ userId: riderId, role: "rider" }],
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
    reminderRules: [
      {
        id: reminderId,
        riderId,
        motorcycleId,
        title: "Bao duong",
        nextDueAt: new Date("2026-06-24T03:00:00Z"),
        enabled: true,
        failureCount: 0,
        createdAt: now,
        updatedAt: now
      }
    ],
    reminderOccurrences: [
      {
        id: occurrenceId,
        ruleId: reminderId,
        riderId,
        motorcycleId,
        dueAt: new Date("2026-06-24T03:00:00Z"),
        status: "due",
        retryCount: 0,
        createdAt: now
      }
    ]
  });

  return createServiceRequestRouteHandlers({
    authenticate: async () => identity(riderId),
    serviceRequestService: new ServiceRequestService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        uuid(1),
        requestId,
        uuid(2),
        uuid(3),
        uuid(4),
        uuid(5),
        uuid(6),
        uuid(7)
      ])
    })
  });
}

function request(body: unknown, token: string, idempotencyKey: string) {
  return new Request("http://localhost/api/v1/service-requests", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "x-idempotency-key": idempotencyKey,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
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
  return `${index.toString(16).padStart(8, "0")}-eeee-4eee-8eee-${index
    .toString(16)
    .padStart(12, "0")}`;
}
