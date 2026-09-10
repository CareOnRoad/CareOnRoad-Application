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
