import { describe, expect, it, vi } from "vitest";

import { MotorcycleService } from "@/features/motorcycles/motorcycle.service";
import type { PlanCode } from "@/features/plans/plan";
import type { ReminderRule } from "@/server/repositories/contracts/reminder.repository";
import { InMemoryMotorcycleRepository } from "@/server/repositories/testing/in-memory-motorcycle.repository";
import { InMemoryReminderRepository } from "@/server/repositories/testing/in-memory-reminder.repository";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { findPreset } from "../reminder-presets";
import { ReminderService } from "../reminder.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const otherMotorcycleId = "55555555-5555-4555-8555-555555555555";
const reminderId = "66666666-6666-4666-8666-666666666666";
const archivedMotorcycleId = "77777777-7777-4777-8777-777777777777";
const now = new Date("2026-06-25T03:00:00Z");
// 10:00 on 2026-10-18 in Vietnam; preset tests use dates around this day.
const presetNow = new Date("2026-10-18T03:00:00Z");
type TestPlan = { planCode: PlanCode; planExpiresAt: Date };
const advancePlan: TestPlan = { planCode: "advance", planExpiresAt: new Date("2027-01-01T00:00:00Z") };
const vipPlan: TestPlan = { planCode: "vip", planExpiresAt: new Date("2027-01-01T00:00:00Z") };
const expiredPlan: TestPlan = { planCode: "advance", planExpiresAt: new Date("2026-10-01T00:00:00Z") };

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
      uuid(8), uuid(9), uuid(10)
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
        until: "2026-07-27T03:00:00.000Z"
      })
    ).resolves.toMatchObject({ snoozed_until: "2026-07-27T03:00:00.000Z" });
    await expect(service.snoozeReminderRule(identity(riderId), reminderId, {
      until: "2026-07-26T03:00:00.000Z"
    })).rejects.toMatchObject({ status: 400 });
    const rescheduled = await service.updateReminderRule(identity(riderId), reminderId, {
      motorcycle_id: motorcycleId, title: "Lịch mới", interval_days: 60,
      next_due_at: "2026-08-01T03:00:00.000Z", enabled: true
    });
    expect(rescheduled.snoozed_until).toBeUndefined();
    expect(rescheduled.next_due_at).toBe("2026-08-01T03:00:00.000Z");
    await expect(service.disableReminderRule(identity(riderId), reminderId)).resolves.toMatchObject({
      enabled: false
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.reminderRules).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(5);
    expect(snapshot.auditLogs).toHaveLength(5);
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

describe("ReminderService maintenance presets", () => {
  it("lists the preset catalog for riders only", async () => {
    const service = createPresetService(createUnitOfWork());

    const catalog = await service.listReminderPresets(identity(riderId));
    expect(catalog.unknown_last_done_due_days).toBe(7);
    expect(catalog.items.map((item) => item.item_code)).toEqual([
      "engine_oil",
      "gear_oil",
      "brake_fluid",
      "coolant",
      "insurance_renewal"
    ]);
    await expect(service.listReminderPresets(identity(mechanicId))).rejects.toMatchObject({
      status: 403
    });
  });

  it("requires the plan of the highest-ranked item before applying", async () => {
    const free = createPresetService(createUnitOfWork());
    await expect(
      free.applyReminderPresets(identity(riderId), motorcycleId, {
        usage_level: "normal",
        items: [{ item_code: "engine_oil" }]
      })
    ).rejects.toMatchObject({
      status: 403,
      errorCode: "FORBIDDEN",
      details: { reason: "plan_required", required_plan: "advance" }
    });

    const expired = createPresetService(
      createUnitOfWork({
        users: [activeUser(riderId, expiredPlan), activeUser(otherRiderId), activeUser(mechanicId)]
      })
    );
    await expect(
      expired.applyReminderPresets(identity(riderId), motorcycleId, {
        usage_level: "normal",
        items: [{ item_code: "engine_oil" }]
      })
    ).rejects.toMatchObject({ status: 403, details: { required_plan: "advance" } });

    const advanceUnitOfWork = createAdvanceUnitOfWork();
    const advance = createPresetService(advanceUnitOfWork);
    for (const items of [
      [{ item_code: "insurance_renewal" }],
      [{ item_code: "engine_oil" }, { item_code: "insurance_renewal" }]
    ]) {
      await expect(
        advance.applyReminderPresets(identity(riderId), motorcycleId, {
          usage_level: "normal",
          items
        })
      ).rejects.toMatchObject({
        status: 403,
        details: { reason: "plan_required", required_plan: "vip" }
      });
    }
    expect(advanceUnitOfWork.snapshot().reminderRules).toHaveLength(0);
  });

  it("creates the requested presets with catalog title, interval and due date", async () => {
    const unitOfWork = createAdvanceUnitOfWork();
    const service = createPresetService(unitOfWork);

    const result = await service.applyReminderPresets(identity(riderId), motorcycleId, {
      usage_level: "normal",
      items: [{ item_code: "engine_oil", last_done_on: "2026-09-01" }, { item_code: "gear_oil" }]
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      created: true,
      rider_id: riderId,
      motorcycle_id: motorcycleId,
      item_code: "engine_oil",
      title: findPreset("engine_oil").title,
      interval_days: 90,
      last_done_on: "2026-09-01",
      // 2026-09-01 + 90 days at 09:00 Vietnam time.
      next_due_at: "2026-11-30T02:00:00.000Z",
      enabled: true
    });
    expect(result.items[1]).toMatchObject({
      created: true,
      item_code: "gear_oil",
      interval_days: 330,
      // Unknown last-done date: today + 7 days at 09:00 Vietnam time.
      next_due_at: "2026-10-25T02:00:00.000Z"
    });
    expect(result.items[1]).not.toHaveProperty("last_done_on");

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.reminderRules).toHaveLength(2);
    expect(snapshot.auditLogs.map((entry) => entry.action)).toEqual([
      "reminder.rule.created",
      "reminder.rule.created"
    ]);
    expect(snapshot.outboxEvents).toHaveLength(2);
  });

  it("lets a vip rider apply the vip preset", async () => {
    const service = createPresetService(
      createUnitOfWork({
        users: [activeUser(riderId, vipPlan), activeUser(otherRiderId), activeUser(mechanicId)]
      })
    );

    await expect(
      service.applyReminderPresets(identity(riderId), motorcycleId, {
        usage_level: "light",
        items: [{ item_code: "insurance_renewal", last_done_on: "2026-10-10" }]
      })
    ).resolves.toMatchObject({
      items: [
        {
          created: true,
          item_code: "insurance_renewal",
          interval_days: 365,
          // 2026-10-10 + 365 days - 14 days lead at 09:00 Vietnam time.
          next_due_at: "2027-09-26T02:00:00.000Z"
        }
      ]
    });
  });

  it("keeps an existing preset rule untouched when applied again", async () => {
    const unitOfWork = createAdvanceUnitOfWork();
    const service = createPresetService(unitOfWork);
    const first = await service.applyReminderPresets(identity(riderId), motorcycleId, {
      usage_level: "normal",
      items: [{ item_code: "engine_oil", last_done_on: "2026-09-01" }]
    });

    const second = await service.applyReminderPresets(identity(riderId), motorcycleId, {
      usage_level: "heavy",
      items: [{ item_code: "engine_oil", last_done_on: "2026-10-01" }, { item_code: "coolant" }]
    });

    expect(second.items[0]).toEqual({ ...first.items[0], created: false });
    expect(second.items[1]).toMatchObject({ created: true, item_code: "coolant" });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.reminderRules).toHaveLength(2);
    expect(snapshot.auditLogs).toHaveLength(2);
  });

  it("rejects invalid apply input and unavailable motorcycles", async () => {
    const unitOfWork = createAdvanceUnitOfWork();
    const service = createPresetService(unitOfWork);
    const apply = (targetMotorcycleId: string, body: unknown) =>
      service.applyReminderPresets(identity(riderId), targetMotorcycleId, body);

    await expect(
      apply(motorcycleId, {
        usage_level: "normal",
        items: [{ item_code: "engine_oil" }, { item_code: "engine_oil", last_done_on: "2026-09-01" }]
      })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(apply(motorcycleId, { usage_level: "normal", items: [] })).rejects.toMatchObject({
      status: 400
    });
    await expect(
      apply(motorcycleId, { usage_level: "extreme", items: [{ item_code: "engine_oil" }] })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      apply(motorcycleId, { usage_level: "normal", items: [{ item_code: "tire" }] })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      apply(motorcycleId, {
        usage_level: "normal",
        items: [{ item_code: "engine_oil", odometer_km: 1 }]
      })
    ).rejects.toMatchObject({ status: 400 });
    for (const lastDoneOn of ["2026-10-19", "2026-02-30", "18/10/2026", "2016-10-01"]) {
      await expect(
        apply(motorcycleId, {
          usage_level: "normal",
          items: [{ item_code: "engine_oil", last_done_on: lastDoneOn }]
        })
      ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    }
    await expect(
      apply(otherMotorcycleId, { usage_level: "normal", items: [{ item_code: "engine_oil" }] })
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      apply(archivedMotorcycleId, { usage_level: "normal", items: [{ item_code: "engine_oil" }] })
    ).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    expect(unitOfWork.snapshot().reminderRules).toHaveLength(0);
  });

  it("applies nothing when one item of a mixed request is invalid", async () => {
    const unitOfWork = createAdvanceUnitOfWork();
    const service = createPresetService(unitOfWork);

    await expect(
      service.applyReminderPresets(identity(riderId), motorcycleId, {
        usage_level: "normal",
        items: [
          { item_code: "engine_oil", last_done_on: "2026-09-01" },
          { item_code: "gear_oil", last_done_on: "2026-10-19" }
        ]
      })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.reminderRules).toHaveLength(0);
    expect(snapshot.auditLogs).toHaveLength(0);
    expect(snapshot.outboxEvents).toHaveLength(0);
  });

  it("counts applied presets towards the motorcycle next maintenance date", async () => {
    const unitOfWork = createAdvanceUnitOfWork();
    const service = createPresetService(unitOfWork);
    const applied = await service.applyReminderPresets(identity(riderId), motorcycleId, {
      usage_level: "normal",
      items: [{ item_code: "engine_oil", last_done_on: "2026-09-01" }, { item_code: "gear_oil" }]
    });
    const earliest = applied.items.map((item) => item.next_due_at).sort()[0];

    const motorcycle = await new MotorcycleService(unitOfWork, { now: () => presetNow }).getMotorcycle(
      identity(riderId),
      motorcycleId
    );

    expect(earliest).toBe("2026-10-25T02:00:00.000Z");
    expect(motorcycle.next_maintenance_at).toBe(earliest);
  });

  it("marks a preset rule done, recomputes the due date and clears the snooze", async () => {
    const unitOfWork = createAdvanceUnitOfWork();
    const service = createPresetService(unitOfWork);
    const applied = await service.applyReminderPresets(identity(riderId), motorcycleId, {
      usage_level: "normal",
      items: [{ item_code: "engine_oil", last_done_on: "2026-09-01" }]
    });
    const ruleId = applied.items[0]!.id;
    await service.snoozeReminderRule(identity(riderId), ruleId, { until: "2026-12-05T02:00:00.000Z" });
    await service.disableReminderRule(identity(riderId), ruleId);

    const done = await service.markReminderDone(identity(riderId), ruleId, { done_on: "2026-10-18" });

    expect(done).toMatchObject({
      id: ruleId,
      item_code: "engine_oil",
      last_done_on: "2026-10-18",
      // 2026-10-18 + 90 days at 09:00 Vietnam time.
      next_due_at: "2027-01-16T02:00:00.000Z",
      interval_days: 90,
      enabled: true
    });
    expect(done).not.toHaveProperty("snoozed_until");
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.reminderRules[0]?.snoozedUntil).toBeUndefined();
    expect(snapshot.auditLogs.map((entry) => entry.action)).toContain("reminder.rule.updated");
  });

  it("rejects done for manual rules, bad dates, expired plans and other riders", async () => {
    const manualRule = ruleFixture({ id: reminderId });
    const presetRule = ruleFixture({
      id: uuid(40),
      title: findPreset("engine_oil").title,
      itemCode: "engine_oil",
      lastDoneOn: "2026-09-01",
      intervalDays: 90
    });
    const advance = createPresetService(
      createUnitOfWork({
        users: [activeUser(riderId, advancePlan), activeUser(otherRiderId), activeUser(mechanicId)],
        reminderRules: [manualRule, presetRule]
      })
    );

    await expect(
      advance.markReminderDone(identity(riderId), manualRule.id, { done_on: "2026-10-18" })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    for (const body of [
      { done_on: "2026-10-19" },
      { done_on: "2026-02-30" },
      { done_on: "2016-10-01" },
      { done_on: "2026-10-18", extra: true },
      {}
    ]) {
      await expect(advance.markReminderDone(identity(riderId), presetRule.id, body)).rejects.toMatchObject({
        status: 400,
        errorCode: "INVALID_INPUT"
      });
    }
    await expect(
      advance.markReminderDone(identity(otherRiderId), presetRule.id, { done_on: "2026-10-18" })
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      advance.markReminderDone(identity(riderId), uuid(99), { done_on: "2026-10-18" })
    ).rejects.toMatchObject({ status: 404 });

    const expired = createPresetService(
      createUnitOfWork({
        users: [activeUser(riderId, expiredPlan), activeUser(otherRiderId), activeUser(mechanicId)],
        reminderRules: [presetRule]
      })
    );
    await expect(
      expired.markReminderDone(identity(riderId), presetRule.id, { done_on: "2026-10-18" })
    ).rejects.toMatchObject({
      status: 403,
      details: { reason: "plan_required", required_plan: "advance" }
    });
  });

  it("locks the motorcycle before the rule when marking done (archive/worker lock order)", async () => {
    const presetRule = ruleFixture({
      id: uuid(42),
      title: findPreset("engine_oil").title,
      itemCode: "engine_oil",
      intervalDays: 90
    });
    const unitOfWork = createUnitOfWork({
      users: [activeUser(riderId, advancePlan), activeUser(otherRiderId), activeUser(mechanicId)],
      reminderRules: [presetRule]
    });
    const locks: string[] = [];
    const lockMotorcycle = vi
      .spyOn(InMemoryMotorcycleRepository.prototype, "findByIdForUpdate")
      .mockImplementation(async function (this: InMemoryMotorcycleRepository, id: string) {
        locks.push("motorcycle");
        return this.findById(id);
      });
    const lockRule = vi
      .spyOn(InMemoryReminderRepository.prototype, "findRuleByIdForUpdate")
      .mockImplementation(async function (this: InMemoryReminderRepository, id: string) {
        locks.push("rule");
        return this.findRuleById(id);
      });
    try {
      await createPresetService(unitOfWork).markReminderDone(identity(riderId), presetRule.id, {
        done_on: "2026-10-18"
      });
    } finally {
      lockMotorcycle.mockRestore();
      lockRule.mockRestore();
    }

    expect(locks).toEqual(["motorcycle", "rule"]);
  });

  it("does not re-enable a rule that belongs to an archived motorcycle", async () => {
    const archivedRule = ruleFixture({
      id: uuid(41),
      motorcycleId: archivedMotorcycleId,
      title: findPreset("engine_oil").title,
      itemCode: "engine_oil",
      enabled: false
    });
    const unitOfWork = createUnitOfWork({
      users: [activeUser(riderId, advancePlan), activeUser(otherRiderId), activeUser(mechanicId)],
      reminderRules: [archivedRule]
    });
    const service = createPresetService(unitOfWork);

    await expect(
      service.markReminderDone(identity(riderId), archivedRule.id, { done_on: "2026-10-18" })
    ).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    expect(unitOfWork.snapshot().reminderRules[0]).toMatchObject({ enabled: false });
    expect(unitOfWork.snapshot().reminderRules[0]?.lastDoneOn).toBeUndefined();
  });

  it("keeps item_code and last_done_on when a preset rule is edited", async () => {
    const service = createPresetService(createAdvanceUnitOfWork());
    const applied = await service.applyReminderPresets(identity(riderId), motorcycleId, {
      usage_level: "normal",
      items: [{ item_code: "engine_oil", last_done_on: "2026-09-01" }]
    });

    const updated = await service.updateReminderRule(identity(riderId), applied.items[0]!.id, {
      motorcycle_id: motorcycleId,
      title: "Thay nhot ten khac",
      interval_days: 60,
      next_due_at: "2026-12-01T02:00:00.000Z",
      enabled: true
    });

    expect(updated).toMatchObject({
      title: "Thay nhot ten khac",
      item_code: "engine_oil",
      last_done_on: "2026-09-01"
    });
  });
});

function createService(unitOfWork: InMemoryUnitOfWork, ids: string[]) {
  return new ReminderService(unitOfWork, {
    now: () => now,
    createId: sequentialIds(ids)
  });
}

function createPresetService(unitOfWork: InMemoryUnitOfWork) {
  let counter = 100;
  return new ReminderService(unitOfWork, {
    now: () => presetNow,
    createId: () => uuid(++counter)
  });
}

function createAdvanceUnitOfWork() {
  return createUnitOfWork({
    users: [activeUser(riderId, advancePlan), activeUser(otherRiderId), activeUser(mechanicId)]
  });
}

function ruleFixture(overrides: Partial<ReminderRule> & { id: string }): ReminderRule {
  return {
    riderId,
    motorcycleId,
    title: "Nhac tay",
    nextDueAt: new Date("2026-11-01T02:00:00Z"),
    enabled: true,
    failureCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
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
      },
      {
        id: archivedMotorcycleId,
        riderId,
        brandText: "Suzuki",
        modelText: "Raider",
        archivedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ],
    ...overrides
  });
}

function activeUser(id: string, plan?: TestPlan) {
  return { id, status: "active" as const, createdAt: now, updatedAt: now, ...plan };
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
