import { describe, expect, it } from "vitest";

import { DispatchService } from "@/features/dispatch/dispatch.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { ServiceRequestService } from "../service-request.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const otherMotorcycleId = "55555555-5555-4555-8555-555555555555";
const requestId = "66666666-6666-4666-8666-666666666666";
const now = new Date("2026-06-25T03:00:00Z");
const future = "2026-06-26T03:00:00.000Z";

describe("ServiceRequestService", () => {
  it("enforces the exact Patch 3 service-type matrix and keeps other non-emergency", async () => {
    const scenarios = [
      {
        service_type: "emergency_rescue",
        location: { latitude: 10.762622, longitude: 106.660172 }
      },
      { service_type: "mobile_repair", address_text: "1 Nguyen Trai" },
      { service_type: "at_home_service", address_text: "1 Nguyen Trai", scheduled_start_at: future },
      { service_type: "periodic_maintenance", scheduled_start_at: future },
      {
        service_type: "other",
        fulfillment_mode: "immediate_location",
        address_text: "1 Nguyen Trai"
      },
      {
        service_type: "other",
        fulfillment_mode: "scheduled_visit",
        address_text: "1 Nguyen Trai",
        scheduled_start_at: future
      }
    ] as const;

    const service = createService(createUnitOfWork(), Array.from({ length: 60 }, (_, index) => uuid(index + 1)));

    for (const scenario of scenarios) {
      await expect(
        service.createServiceRequest(
          identity(riderId),
          {
            motorcycle_id: motorcycleId,
            problem_description: "Xe can ho tro",
            ...scenario
          },
          `matrix-${scenario.service_type}-${
            "fulfillment_mode" in scenario ? scenario.fulfillment_mode : "fixed"
          }`
        )
      ).resolves.toMatchObject({
        service_type: scenario.service_type,
        priority: scenario.service_type === "emergency_rescue" ? "emergency" : "normal"
      });
    }

    await expect(
      service.createServiceRequest(
        identity(riderId),
        {
          motorcycle_id: motorcycleId,
          service_type: "periodic_maintenance",
          problem_description: "Bao duong dinh ky"
        },
        "missing-schedule"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createServiceRequest(
        identity(riderId),
        {
          motorcycle_id: motorcycleId,
          service_type: "mobile_repair",
          fulfillment_mode: "immediate_location",
          problem_description: "Xe can sua",
          address_text: "1 Nguyen Trai"
        },
        "fixed-mode"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createServiceRequest(
        identity(riderId),
        {
          motorcycle_id: motorcycleId,
          service_type: "other",
          problem_description: "Khac",
          address_text: "1 Nguyen Trai"
        },
        "other-no-mode"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createServiceRequest(
        identity(riderId),
        {
          motorcycle_id: motorcycleId,
          service_type: "periodic_maintenance",
          problem_description: "Bao duong",
          scheduled_start_at: "2026-06-24T03:00:00.000Z"
        },
        "past-schedule"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
  });

  it("enforces ownership and writes sanitized domain/history/audit/outbox rows atomically", async () => {
    const unitOfWork = createUnitOfWork();
    const service = createService(unitOfWork, [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      requestId,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      "99999999-9999-4999-8999-999999999999",
      "88888888-8888-4888-8888-888888888888"
    ]);

    const created = await service.createServiceRequest(
      identity(riderId),
      {
        motorcycle_id: motorcycleId,
        service_type: "mobile_repair",
        problem_description: "Private note: bi tat may",
        address_text: "1 Nguyen Trai",
        media_metadata: [
          {
            media_type: "image",
            object_reference: "private/object-key.jpg",
            content_type: "image/jpeg"
          }
        ]
      },
      "owned-create"
    );
    expect(created).toMatchObject({ id: requestId, request_code: "COR-MOB-20260625-1" });

    await expect(service.getServiceRequest(identity(otherRiderId), requestId)).rejects.toMatchObject({
      status: 403,
      errorCode: "FORBIDDEN"
    });
    await expect(
      service.createServiceRequest(
        identity(riderId),
        {
          motorcycle_id: otherMotorcycleId,
          service_type: "mobile_repair",
          problem_description: "Xe cua nguoi khac",
          address_text: "1 Nguyen Trai"
        },
        "other-motorcycle"
      )
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      service.createServiceRequest(
        identity(mechanicId),
        {
          motorcycle_id: motorcycleId,
          service_type: "mobile_repair",
          problem_description: "Mechanic khong duoc tao",
          address_text: "1 Nguyen Trai"
        },
        "mechanic-create"
      )
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.serviceRequests).toHaveLength(1);
    expect(snapshot.requestStatusHistory).toHaveLength(1);
    expect(snapshot.requestMediaMetadata).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.auditLogs).toHaveLength(1);
    expect(JSON.stringify({ outbox: snapshot.outboxEvents, audit: snapshot.auditLogs })).not.toContain(
      "Private note"
    );
    expect(JSON.stringify({ outbox: snapshot.outboxEvents, audit: snapshot.auditLogs })).not.toContain(
      "private/object-key.jpg"
    );
  });

  it("cancels only valid states and writes cancellation history atomically", async () => {
    const unitOfWork = createUnitOfWork();
    const service = createService(unitOfWork, Array.from({ length: 20 }, (_, index) => uuid(index + 30)));
    const created = await service.createServiceRequest(
      identity(riderId),
      {
        motorcycle_id: motorcycleId,
        service_type: "mobile_repair",
        problem_description: "Can huy sau do",
        address_text: "1 Nguyen Trai"
      },
      "cancel-create"
    );

    await expect(
      service.cancelServiceRequest(identity(riderId), created.id, { reason: "Khong can nua" })
    ).resolves.toMatchObject({ status: "canceled", canceled_reason: "Khong can nua" });
    await expect(
      service.cancelServiceRequest(identity(riderId), created.id, { reason: "Huy lan nua" })
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    expect(unitOfWork.snapshot().requestStatusHistory.map((row) => row.toStatus)).toEqual([
      "submitted",
      "canceled"
    ]);
  });

  it("closes active dispatch and removes mechanic offers when the rider cancels", async () => {
    const roundId = "77777777-7777-4777-8777-777777777777";
    const offerId = "88888888-8888-4888-8888-888888888888";
    const unitOfWork = createUnitOfWork({
      serviceRequests: [
        {
          id: requestId,
          requestCode: "COR-MOB-20260625-9",
          riderId,
          motorcycleId,
          serviceType: "mobile_repair",
          problemDescription: "Can huy dispatch",
          status: "offered",
          priority: "normal",
          serviceLocation: { latitude: 10.762622, longitude: 106.660172 },
          createdAt: now,
          updatedAt: now
        }
      ],
      dispatchRounds: [
        {
          id: roundId,
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
          roundId,
          requestId,
          mechanicId,
          rank: 1,
          status: "offered",
          offeredAt: now,
          expiresAt: new Date(now.getTime() + 60_000),
          createdAt: now
        }
      ]
    });
    const service = createService(unitOfWork, [uuid(70), uuid(71), uuid(72)]);

    await service.cancelServiceRequest(identity(riderId), requestId, {
      reason: "Khong can nua"
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.dispatchRounds[0]?.status).toBe("canceled");
    expect(snapshot.dispatchCandidates[0]?.status).toBe("cancelled");
    await expect(
      new DispatchService(unitOfWork, { now: () => now }).listMyOffers(identity(mechanicId))
    ).resolves.toEqual({ items: [] });
  });

  it("rolls request creation back when required outbox write conflicts", async () => {
    const occurrenceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const unitOfWork = createUnitOfWork({
      outboxEvents: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          topic: "service_request.created",
          aggregateType: "service_request",
          aggregateId: requestId,
          dedupeKey: `service_request.created:${requestId}:${occurrenceId}`,
          payload: {},
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: now,
          createdAt: now
        }
      ]
    });
    const service = createService(unitOfWork, [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      requestId,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      occurrenceId,
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    ]);

    await expect(
      service.createServiceRequest(
        identity(riderId),
        {
          motorcycle_id: motorcycleId,
          service_type: "mobile_repair",
          problem_description: "Rollback",
          address_text: "1 Nguyen Trai"
        },
        "rollback-key"
      )
    ).rejects.toThrow("OUTBOX_DEDUPE_KEY_EXISTS");

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.serviceRequests).toHaveLength(0);
    expect(snapshot.requestStatusHistory).toHaveLength(0);
    expect(snapshot.auditLogs).toHaveLength(0);
    expect(snapshot.outboxEvents).toHaveLength(1);
  });
});

function createService(unitOfWork: InMemoryUnitOfWork, ids: string[]) {
  return new ServiceRequestService(unitOfWork, {
    now: () => now,
    createId: sequentialIds(ids)
  });
}

function createUnitOfWork(overrides: Partial<ConstructorParameters<typeof InMemoryUnitOfWork>[0]> = {}) {
  return new InMemoryUnitOfWork({
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
      },
      {
        id: otherMotorcycleId,
        riderId: otherRiderId,
        brandText: "Yamaha",
        modelText: "Sirius",
        createdAt: now,
        updatedAt: now
      }
    ],
    ...overrides
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
  return `${index.toString(16).padStart(8, "0")}-aaaa-4aaa-8aaa-${index
    .toString(16)
    .padStart(12, "0")}`;
}
