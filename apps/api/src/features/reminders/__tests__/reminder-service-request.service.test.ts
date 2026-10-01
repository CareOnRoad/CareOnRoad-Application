import { describe, expect, it } from "vitest";

import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const otherMotorcycleId = "55555555-5555-4555-8555-555555555555";
const riderSecondMotorcycleId = "55555555-aaaa-4555-8555-555555555555";
const reminderId = "66666666-6666-4666-8666-666666666666";
const occurrenceId = "77777777-7777-4777-8777-777777777777";
const requestId = "88888888-8888-4888-8888-888888888888";
const now = new Date("2026-06-25T03:00:00Z");

describe("reminder-originated service requests", () => {
  it("creates submitted periodic maintenance from an owned due occurrence and preserves idempotency", async () => {
    const unitOfWork = createUnitOfWork();
    const service = createService(unitOfWork, [
      uuid(1),
      requestId,
      uuid(2),
      uuid(3),
      uuid(4),
      uuid(5),
      uuid(6),
      uuid(7),
      uuid(8)
    ]);

    const input = {
      motorcycle_id: motorcycleId,
      service_type: "periodic_maintenance",
          location: { latitude: 10.77, longitude: 106.69 },
      problem_description: "Bao duong tu lich hen",
      reminder_id: reminderId,
      reminder_context_id: occurrenceId
    };
    const created = await service.createServiceRequest(identity(riderId), input, "reminder-key");
    expect(created).toMatchObject({
      id: requestId,
      status: "submitted",
      reminder_id: reminderId,
      reminder_context_id: occurrenceId
    });
    expect(created).not.toHaveProperty("scheduled_start_at");
    await expect(service.createServiceRequest(identity(riderId), input, "reminder-key")).resolves.toEqual(
      created
    );
    await expect(
      service.createServiceRequest(
        identity(riderId),
        { ...input, problem_description: "Payload khac" },
        "reminder-key"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.serviceRequests[0]).toMatchObject({
      reminderId,
      reminderContextId: occurrenceId,
      status: "submitted"
    });
    expect(snapshot.reminderOccurrences[0]).toMatchObject({ id: occurrenceId, status: "dismissed" });
    expect(snapshot.requestStatusHistory).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(2);
    expect(snapshot.auditLogs).toHaveLength(1);
  });

  it("rejects missing schedule without due context and invalid due-context ownership/state", async () => {
    const service = createService(createUnitOfWork(), Array.from({ length: 30 }, (_, index) => uuid(index + 10)));
    const baseInput = {
      motorcycle_id: motorcycleId,
      service_type: "periodic_maintenance",
          location: { latitude: 10.77, longitude: 106.69 },
      problem_description: "Bao duong"
    };

    await expect(
      service.createServiceRequest(identity(riderId), baseInput, "missing-context")
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createServiceRequest(
        identity(otherRiderId),
        {
          ...baseInput,
          motorcycle_id: otherMotorcycleId,
          reminder_id: reminderId,
          reminder_context_id: occurrenceId
        },
        "cross-rider"
      )
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      service.createServiceRequest(
        identity(riderId),
        {
          ...baseInput,
          motorcycle_id: riderSecondMotorcycleId,
          reminder_id: reminderId,
          reminder_context_id: occurrenceId
        },
        "mismatch-motorcycle"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    await expect(
      service.createServiceRequest(
        identity(riderId),
        {
          ...baseInput,
          reminder_id: reminderId,
          reminder_context_id: "99999999-9999-4999-8999-999999999999"
        },
        "non-due"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });
});

function createService(unitOfWork: InMemoryUnitOfWork, ids: string[]) {
  return new ServiceRequestService(unitOfWork, {
    now: () => now,
    createId: sequentialIds(ids)
  });
}

function createUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [activeUser(riderId), activeUser(otherRiderId)],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: otherRiderId, role: "rider" }
    ],
    motorcycles: [
      {
        id: motorcycleId,
        riderId,
        brandText: "Honda",
        modelText: "Wave",
        createdAt: now,
        updatedAt: now
      },
      {
        id: otherMotorcycleId,
        riderId: otherRiderId,
        brandText: "Yamaha",
        modelText: "Sirius",
        createdAt: now,
        updatedAt: now
      },
      {
        id: riderSecondMotorcycleId,
        riderId,
        brandText: "Honda",
        modelText: "Lead",
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
      },
      {
        id: "99999999-9999-4999-8999-999999999999",
        ruleId: reminderId,
        riderId,
        motorcycleId,
        dueAt: new Date("2026-06-26T03:00:00Z"),
        status: "due",
        retryCount: 0,
        createdAt: now
      }
    ]
  });
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

function uuid(index: number): string {
  return `${index.toString(16).padStart(8, "0")}-bbbb-4bbb-8bbb-${index
    .toString(16)
    .padStart(12, "0")}`;
}
