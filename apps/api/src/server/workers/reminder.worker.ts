import { randomUUID } from "node:crypto";

import type { ReminderRule } from "@/server/repositories/contracts/reminder.repository";
import { persistNotification } from "@/features/notifications/notification.service";
import type { FoundationRepositories, UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LEASE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderWorkerResult = {
  claimed: number;
  generated: number;
  /** @deprecated Push outcomes belong to notification receipts. */
  sent: number;
  queued: number;
  failed: number;
};

export class ReminderWorker {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: {
      now?: () => Date;
      createId?: () => string;
      workerId?: string;
      batchSize?: number;
      leaseMs?: number;
    } = {}
  ) {}

  async processDueReminders(): Promise<ReminderWorkerResult> {
    const now = this.options.now?.() ?? new Date();
    const workerId = `${this.options.workerId ?? "reminder-worker"}:${randomUUID()}`;
    const createId = this.options.createId ?? randomUUID;
    const rules = await this.unitOfWork.execute(({ reminders }) => reminders.claimDueRules({
      now, leaseOwner: workerId,
      leaseUntil: new Date(now.getTime() + (this.options.leaseMs ?? DEFAULT_LEASE_MS)),
      limit: this.options.batchSize ?? DEFAULT_BATCH_SIZE
    }));
    const result = { claimed: rules.length, generated: 0, sent: 0, queued: 0, failed: 0 };
    for (const claimed of rules) {
      try {
        const outcome = await this.unitOfWork.execute(async (repositories) => {
          const { reminders } = repositories;
          // Match archive's motorcycle -> rule lock order before rechecking eligibility.
          const motorcycle = await repositories.motorcycles.findByIdForUpdate(claimed.motorcycleId);
          const rule = await reminders.findRuleByIdForUpdate(claimed.id);
          if (!rule || rule.leaseOwner !== workerId || !rule.enabled) return undefined;
          const actor = await repositories.users.findActorById(rule.riderId);
          if (!motorcycle || motorcycle.archivedAt || motorcycle.riderId !== rule.riderId || !actor || actor.status !== "active" || !actor.roles.includes("rider")) {
            await reminders.completeRuleClaim({ id: rule.id, enabled: false, lastCompletedAt: now, updatedAt: now });
            return undefined;
          }
          const dueAt = effectiveDueAt(rule);
          // An update or snooze may have postponed this rule after the claim.
          if (dueAt > now) {
            await reminders.failRuleClaim({ id: rule.id, updatedAt: now });
            return undefined;
          }
          const created = await reminders.createOccurrenceIfNotExists({
            id: createId(), ruleId: rule.id, riderId: rule.riderId,
            motorcycleId: rule.motorcycleId, dueAt, status: "due", createdAt: now
          });
          const notification = ["dismissed", "sent", "queued"].includes(created.occurrence.status) ? undefined :
            await queueReminderNotification(repositories, rule, created.occurrence.id, dueAt, now, createId);
          if (notification && !["pending", "sent"].includes(notification.notification.status)) throw new Error("Reminder delivery requires admin recovery.");
          if (notification) await reminders.updateOccurrenceStatus({
            id: created.occurrence.id, status: "queued", notificationId: notification.notification.id,
            processedAt: now,
            retryCount: created.occurrence.retryCount + (created.occurrence.status === "failed" ? 1 : 0)
          });
          await reminders.completeRuleClaim({
            id: rule.id, nextDueAt: rule.intervalDays ? nextRecurringDueAt(dueAt, rule.intervalDays, now) : undefined,
            enabled: Boolean(rule.intervalDays), lastCompletedAt: now, updatedAt: now
          });
          return { generated: created.created, queued: Boolean(notification?.created) };
        });
        result.generated += outcome?.generated ? 1 : 0;
        result.queued += outcome?.queued ? 1 : 0;
      } catch {
        result.failed += 1;
        await this.unitOfWork.execute(async ({ reminders }) => {
          const rule = await reminders.findRuleByIdForUpdate(claimed.id);
          if (rule?.leaseOwner === workerId) await reminders.failRuleClaim({ id: rule.id, updatedAt: now });
        });
      }
    }
    return result;
  }
}

function effectiveDueAt(rule: ReminderRule): Date {
  return rule.snoozedUntil ?? rule.nextDueAt;
}

function nextRecurringDueAt(dueAt: Date, intervalDays: number, now: Date): Date {
  let next = new Date(dueAt.getTime() + intervalDays * DAY_MS);
  while (next.getTime() <= now.getTime()) {
    next = new Date(next.getTime() + intervalDays * DAY_MS);
  }
  return next;
}

export function queueReminderNotification(
  repositories: FoundationRepositories, rule: ReminderRule, occurrenceId: string,
  dueAt: Date, now: Date, createId: () => string
) {
  return persistNotification(repositories, {
    userId: rule.riderId, type: "maintenance.reminder", title: "Đến lịch bảo dưỡng xe",
    body: rule.title, data: { reminder_id: rule.id, reminder_context_id: occurrenceId,
      motorcycle_id: rule.motorcycleId, due_at: dueAt.toISOString() },
    dedupeKey: `maintenance.reminder:${occurrenceId}`
  }, now, createId);
}
