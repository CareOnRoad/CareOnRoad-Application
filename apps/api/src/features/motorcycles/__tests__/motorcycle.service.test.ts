import { describe, expect, it } from "vitest";

import { deliverOutboxEvent } from "@/features/outbox/outbox-consumers";
import type { PlanCode } from "@/features/plans/plan";
import type { MotorcycleDetails } from "@/server/repositories/contracts/motorcycle.repository";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { MotorcycleService } from "../motorcycle.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-06-25T03:00:00Z");

type TestPlan = { planCode: PlanCode; planExpiresAt: Date };
const vipPlan: TestPlan = { planCode: "vip", planExpiresAt: new Date("2027-01-01T00:00:00Z") };
const expiredVipPlan: TestPlan = { planCode: "vip", planExpiresAt: new Date("2026-06-01T00:00:00Z") };
const vipFrame = { frame_number: "RLHJF1234", purchase_price_vnd: 32000000 };

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

  describe("updateMotorcycleDetails", () => {
    const requiredVip = {
      status: 403,
      errorCode: "FORBIDDEN",
      details: { reason: "plan_required", required_plan: "vip" }
    };

    it("rejects non-null values for free and expired-plan riders but still allows clearing", async () => {
      const uow = detailsUnitOfWork(undefined, { color: "Xanh", frameNumber: "KEEPME" });
      const service = detailsService(uow);

      await expect(
        service.updateMotorcycleDetails(riderIdentity, motorcycleId, { color: "Đỏ" })
      ).rejects.toMatchObject(requiredVip);
      await expect(
        detailsService(detailsUnitOfWork(expiredVipPlan)).updateMotorcycleDetails(riderIdentity, motorcycleId, {
          color: "Đỏ"
        })
      ).rejects.toMatchObject(requiredVip);
      // A rejected request must not touch the stored value.
      expect(uow.snapshot().motorcycles[0]?.details).toEqual({ color: "Xanh", frameNumber: "KEEPME" });

      // D14: clearing is always allowed, a mixed null/value body is not.
      await expect(
        service.updateMotorcycleDetails(riderIdentity, motorcycleId, { color: null, frame_number: "X1" })
      ).rejects.toMatchObject(requiredVip);
      await expect(
        service.updateMotorcycleDetails(riderIdentity, motorcycleId, { color: null })
      ).resolves.toMatchObject({ details: { frame_number: "KEEPME" } });
      expect(uow.snapshot().motorcycles[0]?.details).toEqual({ frameNumber: "KEEPME" });
    });

    it("applies a partial update for vip riders and returns only non-null keys", async () => {
      const service = detailsService(detailsUnitOfWork(vipPlan));

      await expect(service.getMotorcycle(riderIdentity, motorcycleId)).resolves.toMatchObject({ details: {} });
      await expect(
        service.updateMotorcycleDetails(riderIdentity, motorcycleId, { ...vipFrame, color: "  Đỏ  " })
      ).resolves.toMatchObject({
        details: { color: "Đỏ", frame_number: "RLHJF1234", purchase_price_vnd: 32000000 }
      });
      const afterColorClear = await service.updateMotorcycleDetails(riderIdentity, motorcycleId, { color: null });
      expect(afterColorClear.details).toEqual({ frame_number: "RLHJF1234", purchase_price_vnd: 32000000 });

      const afterAdd = await service.updateMotorcycleDetails(riderIdentity, motorcycleId, {
        color: "Đỏ",
        purchase_date: "2026-06-25",
        insurance_expires_on: "2027-03-01",
        warranty_expires_on: "2028-03-01",
        engine_number: "JF123E",
        insurance_provider: "Bảo Việt",
        insurance_policy_number: "BV-001",
        preferred_service_center: "Head Quận 7"
      });
      expect(afterAdd.details).toEqual({
        color: "Đỏ",
        frame_number: "RLHJF1234",
        engine_number: "JF123E",
        purchase_date: "2026-06-25",
        purchase_price_vnd: 32000000,
        insurance_provider: "Bảo Việt",
        insurance_policy_number: "BV-001",
        insurance_expires_on: "2027-03-01",
        warranty_expires_on: "2028-03-01",
        preferred_service_center: "Head Quận 7"
      });
    });

    it("keeps frame_number when only color is sent, and the basic PATCH never wipes details", async () => {
      const service = detailsService(detailsUnitOfWork(vipPlan));
      await service.updateMotorcycleDetails(riderIdentity, motorcycleId, vipFrame);
      await expect(
        service.updateMotorcycleDetails(riderIdentity, motorcycleId, { color: "Đỏ" })
      ).resolves.toMatchObject({ details: { frame_number: "RLHJF1234", color: "Đỏ" } });

      const basic = await service.updateMotorcycle(riderIdentity, motorcycleId, {
        brand_text: "Honda",
        model_text: "Future"
      });
      const expectedDetails = { frame_number: "RLHJF1234", purchase_price_vnd: 32000000, color: "Đỏ" };
      expect(basic).toMatchObject({ model_text: "Future" });
      expect(basic.details).toEqual(expectedDetails);
      await expect(service.getMotorcycle(riderIdentity, motorcycleId)).resolves.toMatchObject({
        details: expectedDetails
      });
      const listed = await service.listMotorcycles(riderIdentity);
      expect(listed.items[0]?.details).toEqual(expectedDetails);
    });

    it("rejects invalid bodies with 400 before any plan check", async () => {
      const service = detailsService(detailsUnitOfWork(vipPlan));
      const bad: unknown[] = [
        {},
        { unknown_key: "x" },
        { color: "   " },
        { color: "x".repeat(51) },
        { frame_number: "x".repeat(51) },
        { insurance_provider: "x".repeat(101) },
        { preferred_service_center: "x".repeat(201) },
        { purchase_price_vnd: -1 },
        { purchase_price_vnd: 1.5 },
        { purchase_price_vnd: 1_000_000_000_000 },
        { purchase_date: "2026-06-26" },
        { purchase_date: "2026-02-30" },
        { purchase_date: "25/06/2026" },
        { purchase_date: "1900-01-01" },
        { insurance_expires_on: "not-a-date" },
        { warranty_expires_on: "2026-13-01" },
        "frame",
        null
      ];
      for (const body of bad) {
        await expect(service.updateMotorcycleDetails(riderIdentity, motorcycleId, body)).rejects.toMatchObject({
          status: 400,
          errorCode: "INVALID_INPUT"
        });
      }
      // One message covers both bounds (future and older than 100 years).
      for (const purchase_date of ["2026-06-26", "1900-01-01"]) {
        await expect(
          service.updateMotorcycleDetails(riderIdentity, motorcycleId, { purchase_date })
        ).rejects.toThrow("purchase_date must be today or earlier (Vietnam time) and within 100 years.");
      }
      // Future insurance/warranty expiry is normal, and a purchase today (Vietnam) is allowed.
      await expect(
        service.updateMotorcycleDetails(riderIdentity, motorcycleId, {
          purchase_date: "2026-06-25",
          warranty_expires_on: "2030-01-01"
        })
      ).resolves.toMatchObject({ details: { purchase_date: "2026-06-25", warranty_expires_on: "2030-01-01" } });

      // Validation runs before the plan gate, so a free rider also gets 400 for a future date.
      await expect(
        detailsService(detailsUnitOfWork()).updateMotorcycleDetails(riderIdentity, motorcycleId, {
          purchase_date: "2026-06-26"
        })
      ).rejects.toMatchObject({ status: 400 });
    });

    it("keeps ownership and role checks", async () => {
      const service = detailsService(detailsUnitOfWork(vipPlan));
      await expect(
        service.updateMotorcycleDetails(otherRiderIdentity, motorcycleId, { color: null })
      ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
      await expect(
        service.updateMotorcycleDetails(mechanicIdentity, motorcycleId, { color: null })
      ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
      await expect(
        service.updateMotorcycleDetails(riderIdentity, otherRiderId, { color: null })
      ).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    });

    it("audits and queues only column names, never the values", async () => {
      const uow = detailsUnitOfWork(vipPlan);
      await detailsService(uow).updateMotorcycleDetails(riderIdentity, motorcycleId, vipFrame);

      const snapshot = uow.snapshot();
      const changedFields = ["frame_number", "purchase_price_vnd"];
      const [event] = snapshot.outboxEvents;
      expect(event).toMatchObject({
        topic: "motorcycle.details_updated",
        aggregateType: "motorcycle",
        aggregateId: motorcycleId,
        payload: { resource_id: motorcycleId, rider_id: riderId, changed_fields: changedFields }
      });
      expect(snapshot.auditLogs).toHaveLength(1);
      expect(snapshot.auditLogs[0]).toMatchObject({
        action: "motorcycle.details_updated",
        entityType: "motorcycle",
        entityId: motorcycleId,
        actorId: riderId,
        // The audit sanitizer already strips rider_id from motorcycle audits (actorId carries it).
        metadata: { resource_id: motorcycleId, changed_fields: changedFields }
      });
      const serialized = JSON.stringify(snapshot.outboxEvents) + JSON.stringify(snapshot.auditLogs);
      expect(serialized).not.toContain("RLHJF1234");
      expect(serialized).not.toContain("32000000");
      // The emitted topic must be deliverable, or the worker dead-letters it.
      await expect(deliverOutboxEvent(event!)).resolves.toBeUndefined();
    });
  });
});

function seededRiderUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [activeUser(riderId)],
    userRoles: [{ userId: riderId, role: "rider" }]
  });
}

function activeUser(id: string, plan?: TestPlan) {
  return {
    id,
    status: "active" as const,
    ...plan,
    createdAt: now,
    updatedAt: now
  };
}

function detailsUnitOfWork(plan?: TestPlan, details?: MotorcycleDetails) {
  return new InMemoryUnitOfWork({
    users: [activeUser(riderId, plan), activeUser(otherRiderId), activeUser(mechanicId)],
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
        ...(details ? { details } : {}),
        createdAt: now,
        updatedAt: now
      }
    ]
  });
}

function detailsService(unitOfWork: InMemoryUnitOfWork) {
  let counter = 0;
  return new MotorcycleService(unitOfWork, {
    now: () => now,
    createId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`
  });
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
