import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { ReminderService } from "../reminder.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const otherMotorcycleId = "55555555-5555-4555-8555-555555555555";
const reminderId = "66666666-6666-4666-8666-666666666666";
const now = new Date("2026-06-25T03:00:00Z");

describe("ReminderService", () => {
  it("creates, lists, updates, snoozes, and disables owned date/time rules", async () => {
    const unitOfWork = createUnitOfWork();
    const service = createService(unitOfWork, [
      reminderId,
      uuid(1),
      uuid(2),
      uuid(3),
      uuid(4),
      uuid(5),
      uuid(6),
      uuid(7),
      uuid(8)
    ]);

    const created = await service.createReminderRule(identity(riderId), {
      motorcycle_id: motorcycleId,
      title: "Bao duong dau nhot",
      interval_days: 30,
      next_due_at: "2026-06-26T03:00:00.000Z",
      enabled: true
    });
    expect(created).toMatchObject({
      id: reminderId,
      rider_id: riderId,
      motorcycle_id: motorcycleId,
      interval_days: 30,
      enabled: true
    });

    await expect(service.listReminderRules(identity(riderId))).resolves.toMatchObject({
      items: [{ id: reminderId }]
    });
    await expect(
      service.updateReminderRule(identity(riderId), reminderId, {
        motorcycle_id: motorcycleId,
        title: "Bao duong lai",
        interval_days: 60,
        next_due_at: "2026-07-25T03:00:00.000Z",
        enabled: true
      })
    ).resolves.toMatchObject({ title: "Bao duong lai", interval_days: 60 });
    await expect(
      service.snoozeReminderRule(identity(riderId), reminderId, {
        until: "2026-06-27T03:00:00.000Z"
      })
    ).resolves.toMatchObject({ snoozed_until: "2026-06-27T03:00:00.000Z" });
    await expect(service.disableReminderRule(identity(riderId), reminderId)).resolves.toMatchObject({
      enabled: false
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.reminderRules).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(4);
    expect(snapshot.auditLogs).toHaveLength(4);
    expect(JSON.stringify({ outbox: snapshot.outboxEvents, audit: snapshot.auditLogs })).not.toContain(
      "Bao duong dau nhot"
    );
  });

  it("rejects odometer/kilometer fields, non-rider actors, and cross-rider motorcycles", async () => {
    const service = createService(createUnitOfWork(), [reminderId]);

    await expect(
      service.createReminderRule(identity(riderId), {
        motorcycle_id: motorcycleId,
        title: "Khong hop le",
        next_due_at: "2026-06-26T03:00:00.000Z",
        enabled: true,
        odometer_km: 1000
      })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createReminderRule(identity(riderId), {
        motorcycle_id: motorcycleId,
        title: "Khong hop le",
        next_due_at: "2026-06-26T03:00:00.000Z",
        enabled: true,
        kilometer_interval: 1000
      })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createReminderRule(identity(mechanicId), {
        motorcycle_id: motorcycleId,
        title: "Mechanic khong duoc tao",
        next_due_at: "2026-06-26T03:00:00.000Z",
        enabled: true
      })
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      service.createReminderRule(identity(riderId), {
        motorcycle_id: otherMotorcycleId,
        title: "Xe nguoi khac",
        next_due_at: "2026-06-26T03:00:00.000Z",
        enabled: true
      })
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
  });
});

function createService(unitOfWork: InMemoryUnitOfWork, ids: string[]) {
  return new ReminderService(unitOfWork, {
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
