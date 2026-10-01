import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { ReminderWorker } from "@/server/workers/reminder.worker";

const riderId = "11111111-1111-4111-8111-111111111111";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-06-25T03:00:00Z");

describe("ReminderWorker", () => {
  it("rolls back one failed rule without losing its recurrence or stopping other rules", async () => {
    const first = uuid(100); const second = uuid(101);
    const uow = createUnitOfWork({ reminderRules: [dueRule(first, { nextDueAt: now, intervalDays: 30 }), dueRule(second, { nextDueAt: now })] });
    let ids = 0;
    const result = await new ReminderWorker(uow, { now: () => now, createId: () => {
      if (++ids === 3) throw new Error("outbox unavailable");
      return uuid(200 + ids);
    } }).processDueReminders();
    expect(result).toMatchObject({ failed: 1, queued: 1, generated: 1 });
    expect(uow.snapshot().reminderRules.find((r) => r.id === first)).toMatchObject({ nextDueAt: now, enabled: true, failureCount: 1 });
    expect(uow.snapshot().reminderOccurrences.map((o) => o.ruleId)).toEqual([second]);
    await new ReminderWorker(uow, { now: () => now }).processDueReminders();
    expect(uow.snapshot().notifications).toHaveLength(2);
    expect(uow.snapshot().reminderRules.find((r) => r.id === first)?.nextDueAt).toEqual(new Date("2026-07-25T03:00:00Z"));
  });

  it("preserves actionable context in inbox without any device and disables archived-motorcycle rules", async () => {
    const ruleId = uuid(100);
    const uow = createUnitOfWork({ reminderRules: [dueRule(ruleId, { nextDueAt: now })] });
    const worker = new ReminderWorker(uow, { now: () => now });
    await worker.processDueReminders(); await worker.processDueReminders();
    const state = uow.snapshot();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]?.data).toMatchObject({ reminder_id: ruleId,
      reminder_context_id: state.reminderOccurrences[0]!.id, motorcycle_id: motorcycleId });
    expect(state.reminderOccurrences[0]?.notificationId).toBe(state.notifications[0]?.id);
    const archived = createUnitOfWork({ reminderRules: [dueRule(ruleId, { nextDueAt: now })],
      motorcycles: [{ id: motorcycleId, riderId, brandText: "Honda", modelText: "Wave", archivedAt: now, createdAt: now, updatedAt: now }] });
    await new ReminderWorker(archived, { now: () => now }).processDueReminders();
    expect(archived.snapshot().notifications).toHaveLength(0);
    expect(archived.snapshot().reminderRules[0]?.enabled).toBe(false);
  });

  it("claims due rules, creates one queued occurrence, writes audit/outbox, and advances recurrence", async () => {
    const unitOfWork = createUnitOfWork({
      reminderRules: [
        dueRule("66666666-6666-4666-8666-666666666666", {
          intervalDays: 30,
          nextDueAt: new Date("2026-06-24T03:00:00Z")
        }),
        dueRule("77777777-7777-4777-8777-777777777777", {
          nextDueAt: new Date("2026-06-26T03:00:00Z")
        })
      ]
    });
    const worker = createWorker(unitOfWork, [uuid(1), uuid(2), uuid(3), uuid(4), uuid(5)]);

    await expect(worker.processDueReminders()).resolves.toEqual({
      claimed: 1,
      generated: 1,
      sent: 0, queued: 1,
      failed: 0
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.reminderOccurrences).toHaveLength(1);
    expect(snapshot.reminderOccurrences[0]).toMatchObject({ status: "queued", retryCount: 0 });
    expect(snapshot.reminderRules[0]).toMatchObject({
      nextDueAt: new Date("2026-07-24T03:00:00Z"),
      enabled: true
    });
    expect(snapshot.outboxEvents.map((event) => event.topic)).toEqual([
      "notification.created"
    ]);
    expect(snapshot.auditLogs.map((log) => log.action)).toEqual([
      "notification.created"
    ]);
  });

  it("uses snoozed time as effective due time and disables one-off rules after processing", async () => {
    const unitOfWork = createUnitOfWork({
      reminderRules: [
        dueRule("66666666-6666-4666-8666-666666666666", {
          nextDueAt: new Date("2026-06-20T03:00:00Z"),
          snoozedUntil: new Date("2026-06-26T03:00:00Z")
        }),
        dueRule("77777777-7777-4777-8777-777777777777", {
          nextDueAt: new Date("2026-06-20T03:00:00Z"),
          snoozedUntil: new Date("2026-06-24T03:00:00Z")
        })
      ]
    });

    await createWorker(unitOfWork, [uuid(10), uuid(11), uuid(12), uuid(13), uuid(14)]).processDueReminders();
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.reminderOccurrences).toHaveLength(1);
    expect(snapshot.reminderOccurrences[0]).toMatchObject({
      ruleId: "77777777-7777-4777-8777-777777777777",
      dueAt: new Date("2026-06-24T03:00:00Z")
    });
    expect(snapshot.reminderRules.find((rule) => rule.id === "77777777-7777-4777-8777-777777777777")).toMatchObject({
      enabled: false,
      snoozedUntil: undefined
    });
  });

  it("retries failed occurrences without duplicating the logical occurrence", async () => {
    const occurrenceId = "99999999-9999-4999-8999-999999999999";
    const ruleId = "66666666-6666-4666-8666-666666666666";
    const unitOfWork = createUnitOfWork({
      reminderRules: [dueRule(ruleId, { nextDueAt: new Date("2026-06-24T03:00:00Z") })],
      reminderOccurrences: [
        {
          id: occurrenceId,
          ruleId,
          riderId,
          motorcycleId,
          dueAt: new Date("2026-06-24T03:00:00Z"),
          status: "failed",
          retryCount: 1,
          lastErrorCode: "TEMPORARY_FAILURE",
          createdAt: now
        }
      ]
    });

    await expect(
      createWorker(unitOfWork, [uuid(20), uuid(21), uuid(22)]).processDueReminders()
    ).resolves.toMatchObject({ claimed: 1, generated: 0, sent: 0, queued: 1, failed: 0 });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.reminderOccurrences).toHaveLength(1);
    expect(snapshot.reminderOccurrences[0]).toMatchObject({
      id: occurrenceId,
      status: "queued",
      retryCount: 2
    });
  });

  it("deduplicates occurrences when workers run concurrently", async () => {
    const unitOfWork = createUnitOfWork({
      reminderRules: [
        dueRule("66666666-6666-4666-8666-666666666666", {
          nextDueAt: new Date("2026-06-24T03:00:00Z")
        })
      ]
    });
    const first = createWorker(unitOfWork, [uuid(30), uuid(31), uuid(32), uuid(33), uuid(34)]);
    const second = createWorker(unitOfWork, [uuid(40), uuid(41), uuid(42), uuid(43), uuid(44)]);

    const results = await Promise.all([first.processDueReminders(), second.processDueReminders()]);
    expect(results.reduce((sum, result) => sum + result.generated, 0)).toBe(1);
    expect(unitOfWork.snapshot().reminderOccurrences).toHaveLength(1);
  });
});

function createWorker(unitOfWork: InMemoryUnitOfWork, ids: string[]) {
  return new ReminderWorker(unitOfWork, {
    now: () => now,
    workerId: "worker-a",
    createId: sequentialIds(ids),
    batchSize: 1
  });
}

function createUnitOfWork(overrides: Partial<ConstructorParameters<typeof InMemoryUnitOfWork>[0]> = {}) {
  return new InMemoryUnitOfWork({
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
    ...overrides
  });
}

function dueRule(
  id: string,
  overrides: {
    intervalDays?: number;
    nextDueAt: Date;
    snoozedUntil?: Date;
  }
) {
  return {
    id,
    riderId,
    motorcycleId,
    title: "Bao duong",
    intervalDays: overrides.intervalDays,
    nextDueAt: overrides.nextDueAt,
    snoozedUntil: overrides.snoozedUntil,
    enabled: true,
    failureCount: 0,
    createdAt: now,
    updatedAt: now
  };
}

function activeUser(id: string) {
  return { id, status: "active" as const, createdAt: now, updatedAt: now };
}

function sequentialIds(ids: string[]): () => string {
  let extraId = 1000;
  return () => {
    const id = ids.shift() ?? `aaaaaaaa-0000-4000-8000-${String(extraId++).padStart(12, "0")}`;
    if (!id) {
      throw new Error("Test ID sequence exhausted.");
    }
    return id;
  };
}

function uuid(index: number): string {
  return `${index.toString(16).padStart(8, "0")}-cccc-4ccc-8ccc-${index
    .toString(16)
    .padStart(12, "0")}`;
}
