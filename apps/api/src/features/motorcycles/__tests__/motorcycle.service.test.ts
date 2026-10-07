import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { MotorcycleService } from "../motorcycle.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-06-25T03:00:00Z");

const riderIdentity = identity(riderId);
const otherRiderIdentity = identity(otherRiderId);
const mechanicIdentity = identity(mechanicId);

describe("MotorcycleService", () => {
  it("creates, lists, reads, updates, and archives only owned motorcycles", async () => {
    const unitOfWork = new InMemoryUnitOfWork({
      users: [
        activeUser(riderId),
        activeUser(otherRiderId),
        activeUser(mechanicId)
      ],
      userRoles: [
        { userId: riderId, role: "rider" },
        { userId: otherRiderId, role: "rider" },
        { userId: mechanicId, role: "mechanic" }
      ]
    });
    const service = new MotorcycleService(unitOfWork, {
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
    });

    const created = await service.createMotorcycle(riderIdentity, {
      brand_text: "Honda",
      model_text: "Wave Alpha",
      license_plate: "59A1-12345",
      year: 2020,
      notes: "Private note"
    });
    expect(created).toMatchObject({
      id: motorcycleId,
      rider_id: riderId,
      brand_text: "Honda",
      model_text: "Wave Alpha"
    });
    await expect(service.listMotorcycles(riderIdentity)).resolves.toMatchObject({
      items: [{ id: motorcycleId }]
    });
    await expect(service.getMotorcycle(riderIdentity, motorcycleId)).resolves.toMatchObject({
      id: motorcycleId
    });
    await expect(service.getMotorcycle(otherRiderIdentity, motorcycleId)).rejects.toMatchObject({
      status: 403,
      errorCode: "FORBIDDEN"
    });
    await expect(service.getMotorcycle(riderIdentity, otherRiderId)).rejects.toMatchObject({
      status: 404,
      errorCode: "NOT_FOUND"
    });
    await expect(
      service.createMotorcycle(mechanicIdentity, {
        brand_text: "Yamaha",
        model_text: "Sirius"
      })
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });

    await expect(
      service.updateMotorcycle(riderIdentity, motorcycleId, {
        brand_text: "Honda",
        model_text: "Future",
        year: 2021
      })
    ).resolves.toMatchObject({ model_text: "Future", year: 2021 });
    await service.archiveMotorcycle(riderIdentity, motorcycleId);
    await expect(service.listMotorcycles(riderIdentity)).resolves.toEqual({ items: [] });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.motorcycles).toHaveLength(1);
    expect(snapshot.motorcycles[0]?.archivedAt).toEqual(now);
    expect(snapshot.outboxEvents.map((event) => event.topic)).toEqual([
      "motorcycle.created",
      "motorcycle.updated",
      "motorcycle.archived"
    ]);
    expect(snapshot.auditLogs.map((log) => log.action)).toEqual([
      "motorcycle.created",
      "motorcycle.updated",
      "motorcycle.archived"
    ]);
    expect(JSON.stringify({ outbox: snapshot.outboxEvents, audit: snapshot.auditLogs })).not.toContain(
      "Private note"
    );
  });

  it("does not require X-Idempotency-Key semantics for motorcycle mutations", async () => {
    const unitOfWork = seededRiderUnitOfWork();
    const service = new MotorcycleService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        motorcycleId,
        "55555555-5555-4555-8555-555555555555",
        "66666666-6666-4666-8666-666666666666"
      ])
    });

    await service.createMotorcycle(riderIdentity, {
      brand_text: "Honda",
      model_text: "Blade"
    });

    expect(unitOfWork.snapshot().idempotencyRecords).toHaveLength(0);
  });

  it("rolls back motorcycle creation when required outbox write fails", async () => {
    const occurrenceId = "55555555-5555-4555-8555-555555555555";
    const unitOfWork = new InMemoryUnitOfWork({
      users: [activeUser(riderId)],
      userRoles: [{ userId: riderId, role: "rider" }],
      outboxEvents: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          topic: "motorcycle.created",
          aggregateType: "motorcycle",
          aggregateId: motorcycleId,
          dedupeKey: `motorcycle.created:${motorcycleId}:${occurrenceId}`,
          payload: {},
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: now,
          createdAt: now
        }
      ]
    });
    const service = new MotorcycleService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        motorcycleId,
        occurrenceId,
        "66666666-6666-4666-8666-666666666666"
      ])
    });

    await expect(
      service.createMotorcycle(riderIdentity, {
        brand_text: "Honda",
        model_text: "Wave"
      })
    ).rejects.toThrow("OUTBOX_DEDUPE_KEY_EXISTS");

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.motorcycles).toHaveLength(0);
    expect(snapshot.auditLogs).toHaveLength(0);
    expect(snapshot.outboxEvents).toHaveLength(1);
  });

  it("derives last_maintenance_at and next_maintenance_at from service requests and reminder rules", async () => {
    const referenceNow = new Date("2026-06-25T12:00:00Z");
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
      serviceRequests: [
        // Completed rescue (older) — should NOT be used (we want MAX).
        {
          id: "11111111-aaaa-4aaa-8aaa-111111111111",
          requestCode: "COR-RESCUE-20260624-1",
          riderId,
          motorcycleId,
          serviceType: "emergency_rescue",
          problemDescription: "Flat tire",
          status: "completed",
          priority: "emergency",
          updatedAt: new Date("2026-06-10T00:00:00Z"),
          createdAt: new Date("2026-06-10T00:00:00Z")
        },
        // Completed maintenance (newer) — should be MAX.
        {
          id: "22222222-aaaa-4aaa-8aaa-222222222222",
          requestCode: "COR-MAINT-20260624-1",
          riderId,
          motorcycleId,
          serviceType: "periodic_maintenance",
          problemDescription: "Oil change",
          status: "completed",
          priority: "normal",
          updatedAt: new Date("2026-06-20T00:00:00Z"),
          createdAt: new Date("2026-06-18T00:00:00Z")
        },
        // Active upcoming maintenance with scheduled_start_at in the future — should be MIN(scheduled).
        {
          id: "33333333-aaaa-4aaa-8aaa-333333333333",
          requestCode: "COR-MAINT-20260624-2",
          riderId,
          motorcycleId,
          serviceType: "periodic_maintenance",
          problemDescription: "Tire check",
          status: "assigned",
          priority: "normal",
          scheduledStartAt: new Date("2026-07-10T00:00:00Z"),
          updatedAt: new Date("2026-06-25T00:00:00Z"),
          createdAt: new Date("2026-06-25T00:00:00Z")
        },
        // Past-scheduled active request — should be filtered out (not in the future).
        {
          id: "44444444-aaaa-4aaa-8aaa-444444444444",
          requestCode: "COR-MAINT-20260624-3",
          riderId,
          motorcycleId,
          serviceType: "periodic_maintenance",
          problemDescription: "Past",
          status: "assigned",
          priority: "normal",
          scheduledStartAt: new Date("2026-06-20T00:00:00Z"),
          updatedAt: new Date("2026-06-20T00:00:00Z"),
          createdAt: new Date("2026-06-20T00:00:00Z")
        },
        // Canceled upcoming maintenance — should be filtered out.
        {
          id: "55555555-aaaa-4aaa-8aaa-555555555555",
          requestCode: "COR-MAINT-20260624-4",
          riderId,
          motorcycleId,
          serviceType: "periodic_maintenance",
          problemDescription: "Canceled",
          status: "canceled",
          priority: "normal",
          scheduledStartAt: new Date("2026-08-01T00:00:00Z"),
          updatedAt: new Date("2026-06-25T00:00:00Z"),
          createdAt: new Date("2026-06-25T00:00:00Z")
        }
      ],
      reminderRules: [
        // Earlier reminder — should win.
        {
          id: "66666666-aaaa-4aaa-8aaa-666666666666",
          riderId,
          motorcycleId,
          title: "Oil change",
          nextDueAt: new Date("2026-07-15T00:00:00Z"),
          enabled: true,
          failureCount: 0,
          createdAt: now,
          updatedAt: now
        },
        // Later reminder — should lose.
        {
          id: "77777777-aaaa-4aaa-8aaa-777777777777",
          riderId,
          motorcycleId,
          title: "Brake check",
          nextDueAt: new Date("2026-08-01T00:00:00Z"),
          enabled: true,
          failureCount: 0,
          createdAt: now,
          updatedAt: now
        },
        // Disabled reminder — should be filtered out.
        {
          id: "88888888-aaaa-4aaa-8aaa-888888888888",
          riderId,
          motorcycleId,
          title: "Disabled",
          nextDueAt: new Date("2026-06-30T00:00:00Z"),
          enabled: false,
          failureCount: 0,
          createdAt: now,
          updatedAt: now
        }
      ]
    });
    const service = new MotorcycleService(unitOfWork, { now: () => referenceNow });

    const list = await service.listMotorcycles(riderIdentity);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.last_maintenance_at).toBe("2026-06-20T00:00:00.000Z");
    // next_maintenance_at = MIN(upcoming, reminder) = MIN(2026-07-10, 2026-07-15) = 2026-07-10
    expect(list.items[0]?.next_maintenance_at).toBe("2026-07-10T00:00:00.000Z");
  });

  it("omits maintenance dates when no completed or upcoming data exists", async () => {
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
      ]
    });
    const service = new MotorcycleService(unitOfWork);

    const list = await service.listMotorcycles(riderIdentity);
    expect(list.items[0]?.last_maintenance_at).toBeUndefined();
    expect(list.items[0]?.next_maintenance_at).toBeUndefined();
  });

  it("derives single-motorcycle maintenance dates via getMotorcycle", async () => {
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
      serviceRequests: [
        {
          id: "99999999-aaaa-4aaa-8aaa-999999999999",
          requestCode: "COR-MAINT-20260624-9",
          riderId,
          motorcycleId,
          serviceType: "periodic_maintenance",
          problemDescription: "Done",
          status: "completed",
          priority: "normal",
          updatedAt: new Date("2026-06-15T00:00:00Z"),
          createdAt: new Date("2026-06-15T00:00:00Z")
        }
      ]
    });
    const service = new MotorcycleService(unitOfWork);

    const one = await service.getMotorcycle(riderIdentity, motorcycleId);
    expect(one.last_maintenance_at).toBe("2026-06-15T00:00:00.000Z");
    expect(one.next_maintenance_at).toBeUndefined();
  });
});

function seededRiderUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [activeUser(riderId)],
    userRoles: [{ userId: riderId, role: "rider" }]
  });
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
