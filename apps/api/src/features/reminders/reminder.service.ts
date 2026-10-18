import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api-error";
import { requireActorRole } from "@/features/auth/authorization";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { hasPlan, planRequiredDetails } from "@/features/plans/plan";
import { isPastOrTodayVietnam } from "@/lib/vietnam-date";
import type { Motorcycle } from "@/server/repositories/contracts/motorcycle.repository";
import type { ReminderRule } from "@/server/repositories/contracts/reminder.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import type { ApplicationActor } from "@/server/repositories/contracts/user.repository";

import {
  MAX_DONE_AGE_DAYS,
  UNKNOWN_LAST_DONE_DUE_DAYS,
  computeNextDueAt,
  findPreset,
  intervalDaysFor,
  reminderPresets,
  toPresetResponse,
  type ReminderItemCode
} from "./reminder-presets";
import {
  reminderDoneSchema,
  reminderPresetApplySchema,
  reminderRuleInputSchema,
  reminderSnoozeInputSchema,
  type ReminderRuleInput
} from "./reminder.schemas";

export type ReminderRuleResponse = {
  id: string;
  rider_id: string;
  motorcycle_id: string;
  title: string;
  interval_days?: number;
  next_due_at: string;
  snoozed_until?: string;
  enabled: boolean;
  item_code?: ReminderItemCode;
  last_done_on?: string;
  last_completed_at?: string;
  last_processed_at?: string;
  created_at: string;
  updated_at: string;
};

export class ReminderService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: { now?: () => Date; createId?: () => string } = {}
  ) {}

  async createReminderRule(
    identity: VerifiedSupabaseIdentity,
    input: unknown
  ): Promise<ReminderRuleResponse> {
    const parsed = parseRuleInput(input);

    return this.unitOfWork.execute(async ({ audit, motorcycles, outbox, reminders, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const motorcycle = await loadOwnedMotorcycle(motorcycles, parsed.motorcycle_id, actor.id);
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const rule = await reminders.createRule({
        id: createId(),
        riderId: actor.id,
        motorcycleId: motorcycle.id,
        title: parsed.title,
        intervalDays: parsed.interval_days,
        nextDueAt: new Date(parsed.next_due_at),
        enabled: parsed.enabled,
        createdAt: now,
        updatedAt: now
      });
      await appendReminderAuditOutbox({
        action: "reminder.rule.created",
        rule,
        actorId: actor.id,
        audit,
        outbox,
        now,
        createId
      });
      return toReminderRuleResponse(rule);
    });
  }

  listReminderRules(identity: VerifiedSupabaseIdentity): Promise<{ items: ReminderRuleResponse[] }> {
    return this.unitOfWork.execute(async ({ reminders, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const rules = await reminders.listRulesByRider(actor.id);
      return { items: rules.map(toReminderRuleResponse) };
    });
  }

  async updateReminderRule(
    identity: VerifiedSupabaseIdentity,
    reminderId: string,
    input: unknown
  ): Promise<ReminderRuleResponse> {
    const parsed = parseRuleInput(input);

    return this.unitOfWork.execute(async ({ audit, motorcycles, outbox, reminders, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const motorcycle = await loadOwnedMotorcycle(motorcycles, parsed.motorcycle_id, actor.id);
      const existing = await loadOwnedReminderRule(reminders, reminderId, actor.id);
      const now = this.options.now?.() ?? new Date();
      const updated = await reminders.updateRule({
        id: existing.id,
        title: parsed.title,
        intervalDays: parsed.interval_days,
        nextDueAt: new Date(parsed.next_due_at),
        enabled: parsed.enabled,
        updatedAt: now
      });
      if (!updated || updated.motorcycleId !== motorcycle.id) {
        throw new ReminderError("NOT_FOUND", "Reminder rule not found.", 404);
      }
      await appendReminderAuditOutbox({
        action: "reminder.rule.updated",
        rule: updated,
        actorId: actor.id,
        audit,
        outbox,
        now,
        createId: this.options.createId ?? randomUUID
      });
      return toReminderRuleResponse(updated);
    });
  }

  snoozeReminderRule(
    identity: VerifiedSupabaseIdentity,
    reminderId: string,
    input: unknown
  ): Promise<ReminderRuleResponse> {
    const parsed = reminderSnoozeInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ReminderError("INVALID_INPUT", "Reminder snooze input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }

    return this.unitOfWork.execute(async ({ audit, outbox, reminders, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const existing = await loadOwnedReminderRule(reminders, reminderId, actor.id);
      const now = this.options.now?.() ?? new Date();
      const snoozedUntil = new Date(parsed.data.until);
      if (snoozedUntil.getTime() <= Math.max(now.getTime(), (existing.snoozedUntil ?? existing.nextDueAt).getTime())) {
        throw new ReminderError("INVALID_INPUT", "Snooze must postpone the effective due time.", 400);
      }
      const updated = await reminders.snoozeRule({
        id: existing.id,
        snoozedUntil,
        updatedAt: now
      });
      if (!updated) {
        throw new ReminderError("NOT_FOUND", "Reminder rule not found.", 404);
      }
      await appendReminderAuditOutbox({
        action: "reminder.rule.snoozed",
        rule: updated,
        actorId: actor.id,
        audit,
        outbox,
        now,
        createId: this.options.createId ?? randomUUID
      });
      return toReminderRuleResponse(updated);
    });
  }

  listReminderPresets(identity: VerifiedSupabaseIdentity) {
    return this.unitOfWork.execute(async ({ users }) => {
      await loadRiderActor(users, identity.subject);
      return {
        unknown_last_done_due_days: UNKNOWN_LAST_DONE_DUE_DAYS,
        items: reminderPresets.map((preset) => toPresetResponse(preset))
      };
    });
  }

  async applyReminderPresets(
    identity: VerifiedSupabaseIdentity,
    motorcycleId: string,
    input: unknown
  ): Promise<{ items: Array<ReminderRuleResponse & { created: boolean }> }> {
    const parsed = reminderPresetApplySchema.safeParse(input);
    if (!parsed.success) {
      throw new ReminderError("INVALID_INPUT", "Reminder preset input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }

    return this.unitOfWork.execute(async ({ audit, motorcycles, outbox, reminders, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const motorcycle = await loadOwnedMotorcycle(motorcycles, motorcycleId, actor.id);
      const now = this.options.now?.() ?? new Date();
      const createId = this.options.createId ?? randomUUID;
      const { usage_level: usageLevel, items } = parsed.data;

      const needsVip = items.some((item) => findPreset(item.item_code).requiredPlan === "vip");
      requirePlan(actor, needsVip ? "vip" : "advance", now);
      for (const item of items) {
        if (item.last_done_on !== undefined) {
          requireDoneDate(item.last_done_on, now);
        }
      }

      const results: Array<ReminderRuleResponse & { created: boolean }> = [];
      for (const item of items) {
        const existing = await reminders.findRuleByMotorcycleItem(motorcycle.id, item.item_code);
        if (existing) {
          results.push({ ...toReminderRuleResponse(existing), created: false });
          continue;
        }
        const preset = findPreset(item.item_code);
        const intervalDays = intervalDaysFor(preset, usageLevel);
        const rule = await reminders.createRule({
          id: createId(),
          riderId: actor.id,
          motorcycleId: motorcycle.id,
          title: preset.title,
          intervalDays,
          nextDueAt: computeNextDueAt({
            lastDoneOn: item.last_done_on,
            intervalDays,
            leadDays: preset.leadDays,
            now
          }),
          enabled: true,
          itemCode: item.item_code,
          lastDoneOn: item.last_done_on,
          createdAt: now,
          updatedAt: now
        });
        await appendReminderAuditOutbox({
          action: "reminder.rule.created",
          rule,
          actorId: actor.id,
          audit,
          outbox,
          now,
          createId
        });
        results.push({ ...toReminderRuleResponse(rule), created: true });
      }
      return { items: results };
    });
  }

  async markReminderDone(
    identity: VerifiedSupabaseIdentity,
    reminderId: string,
    input: unknown
  ): Promise<ReminderRuleResponse> {
    const parsed = reminderDoneSchema.safeParse(input);
    if (!parsed.success) {
      throw new ReminderError("INVALID_INPUT", "Reminder done input is invalid.", 400, {
        issues: parsed.error.issues
      });
    }

    return this.unitOfWork.execute(async ({ audit, motorcycles, outbox, reminders, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      // Lock order must be motorcycle -> rule (as archive, the worker and update do):
      // read the rule unlocked, lock the motorcycle, then lock the rule. motorcycle_id and item_code never change.
      const unlocked = await loadOwnedReminderRule(reminders, reminderId, actor.id, false);
      const itemCode = unlocked.itemCode;
      if (!itemCode) {
        throw new ReminderError("INVALID_INPUT", "Only maintenance preset reminders can be marked done.", 400);
      }
      // An archived motorcycle makes its rules unreachable (404), so done cannot re-enable them.
      await loadOwnedMotorcycle(motorcycles, unlocked.motorcycleId, actor.id);
      const existing = await loadOwnedReminderRule(reminders, reminderId, actor.id);
      const now = this.options.now?.() ?? new Date();
      const preset = findPreset(itemCode);
      requirePlan(actor, preset.requiredPlan, now);
      requireDoneDate(parsed.data.done_on, now);

      const updated = await reminders.markRuleDone({
        id: existing.id,
        lastDoneOn: parsed.data.done_on,
        nextDueAt: computeNextDueAt({
          lastDoneOn: parsed.data.done_on,
          intervalDays: existing.intervalDays ?? intervalDaysFor(preset, "normal"),
          leadDays: preset.leadDays,
          now
        }),
        updatedAt: now
      });
      if (!updated) {
        throw new ReminderError("NOT_FOUND", "Reminder rule not found.", 404);
      }
      await appendReminderAuditOutbox({
        action: "reminder.rule.updated",
        rule: updated,
        actorId: actor.id,
        audit,
        outbox,
        now,
        createId: this.options.createId ?? randomUUID
      });
      return toReminderRuleResponse(updated);
    });
  }

  disableReminderRule(
    identity: VerifiedSupabaseIdentity,
    reminderId: string
  ): Promise<ReminderRuleResponse> {
    return this.unitOfWork.execute(async ({ audit, outbox, reminders, users }) => {
      const actor = await loadRiderActor(users, identity.subject);
      const existing = await loadOwnedReminderRule(reminders, reminderId, actor.id);
      const now = this.options.now?.() ?? new Date();
      const updated = await reminders.disableRule({ id: existing.id, updatedAt: now });
      if (!updated) {
        throw new ReminderError("NOT_FOUND", "Reminder rule not found.", 404);
      }
      await appendReminderAuditOutbox({
        action: "reminder.rule.disabled",
        rule: updated,
        actorId: actor.id,
        audit,
        outbox,
        now,
        createId: this.options.createId ?? randomUUID
      });
      return toReminderRuleResponse(updated);
    });
  }
}

export class ReminderError extends Error {
  constructor(
    public readonly errorCode: Extract<
      ApiErrorCode,
      "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "ACTOR_SUSPENDED"
    >,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ReminderError";
  }
}

function parseRuleInput(input: unknown): ReminderRuleInput {
  const parsed = reminderRuleInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ReminderError("INVALID_INPUT", "Reminder rule input is invalid.", 400, {
      issues: parsed.error.issues
    });
  }
  return parsed.data;
}

async function loadRiderActor(
  users: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["users"],
  actorId: string
) {
  const actor = await users.findActorById(actorId);
  if (!actor) {
    throw new ReminderError("NOT_FOUND", "Application profile not found.", 404);
  }
  requireActorRole(
    {
      id: actor.id,
      ...(actor.displayName ? { display_name: actor.displayName } : {}),
      roles: actor.roles,
      status: actor.status
    },
    "rider"
  );
  return actor;
}

function requirePlan(actor: ApplicationActor, required: "advance" | "vip", now: Date): void {
  if (!hasPlan(actor, required, now)) {
    throw new ReminderError("FORBIDDEN", "A higher plan is required.", 403, planRequiredDetails(required));
  }
}

function requireDoneDate(value: string, now: Date): void {
  if (!isPastOrTodayVietnam(value, now, MAX_DONE_AGE_DAYS)) {
    throw new ReminderError(
      "INVALID_INPUT",
      "Date must be a real YYYY-MM-DD date, not in the future and within the last 10 years.",
      400
    );
  }
}

async function loadOwnedMotorcycle(
  motorcycles: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["motorcycles"],
  motorcycleId: string,
  riderId: string
): Promise<Motorcycle> {
  const motorcycle = await motorcycles.findByIdForUpdate(motorcycleId);
  if (!motorcycle || motorcycle.archivedAt) {
    throw new ReminderError("NOT_FOUND", "Motorcycle not found.", 404);
  }
  if (motorcycle.riderId !== riderId) {
    throw new ReminderError("FORBIDDEN", "Motorcycle ownership is required.", 403);
  }
  return motorcycle;
}

async function loadOwnedReminderRule(
  reminders: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["reminders"],
  reminderId: string,
  riderId: string,
  lock = true
): Promise<ReminderRule> {
  const rule = lock
    ? await reminders.findRuleByIdForUpdate(reminderId)
    : await reminders.findRuleById(reminderId);
  if (!rule) {
    throw new ReminderError("NOT_FOUND", "Reminder rule not found.", 404);
  }
  if (rule.riderId !== riderId) {
    throw new ReminderError("FORBIDDEN", "Reminder ownership is required.", 403);
  }
  return rule;
}

async function appendReminderAuditOutbox(input: {
  action: string;
  rule: ReminderRule;
  actorId: string;
  audit: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["audit"];
  outbox: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["outbox"];
  now: Date;
  createId: () => string;
}): Promise<void> {
  const occurrenceId = input.createId();
  const payload = {
    resource_id: input.rule.id,
    rider_id: input.rule.riderId,
    motorcycle_id: input.rule.motorcycleId,
    enabled: input.rule.enabled
  };
  await input.outbox.append({
    id: occurrenceId,
    topic: input.action,
    aggregateType: "reminder_rule",
    aggregateId: input.rule.id,
    dedupeKey: `${input.action}:${input.rule.id}:${occurrenceId}`,
    payload,
    createdAt: input.now,
    nextAttemptAt: input.now
  });
  await input.audit.append({
    id: input.createId(),
    actorId: input.actorId,
    actorRole: "rider",
    action: input.action,
    entityType: "reminder_rule",
    entityId: input.rule.id,
    metadata: payload,
    createdAt: input.now
  });
}

export function toReminderRuleResponse(rule: ReminderRule): ReminderRuleResponse {
  return {
    id: rule.id,
    rider_id: rule.riderId,
    motorcycle_id: rule.motorcycleId,
    title: rule.title,
    ...(rule.intervalDays ? { interval_days: rule.intervalDays } : {}),
    next_due_at: rule.nextDueAt.toISOString(),
    ...(rule.snoozedUntil ? { snoozed_until: rule.snoozedUntil.toISOString() } : {}),
    enabled: rule.enabled,
    ...(rule.itemCode ? { item_code: rule.itemCode } : {}),
    ...(rule.lastDoneOn ? { last_done_on: rule.lastDoneOn } : {}),
    ...(rule.lastCompletedAt ? { last_completed_at: rule.lastCompletedAt.toISOString() } : {}),
    ...(rule.lastCompletedAt ? { last_processed_at: rule.lastCompletedAt.toISOString() } : {}),
    created_at: rule.createdAt.toISOString(),
    updated_at: rule.updatedAt.toISOString()
  };
}
