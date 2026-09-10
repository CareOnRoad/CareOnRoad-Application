import { randomUUID } from "node:crypto";

import type { ReminderRule } from "@/server/repositories/contracts/reminder.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LEASE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderWorkerResult = {
  claimed: number;
  generated: number;
  sent: number;
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

  processDueReminders(): Promise<ReminderWorkerResult> {
    const now = this.options.now?.() ?? new Date();
    const workerId = this.options.workerId ?? `reminder-worker-${randomUUID()}`;
    const createId = this.options.createId ?? randomUUID;
    const leaseUntil = new Date(now.getTime() + (this.options.leaseMs ?? DEFAULT_LEASE_MS));
    const batchSize = this.options.batchSize ?? DEFAULT_BATCH_SIZE;

    return this.unitOfWork.execute(async ({ audit, outbox, reminders }) => {
      const rules = await reminders.claimDueRules({
        now,
        leaseOwner: workerId,
        leaseUntil,
        limit: batchSize
      });
      const result: ReminderWorkerResult = {
        claimed: rules.length,
        generated: 0,
        sent: 0,
        failed: 0
      };

      for (const rule of rules) {
        try {
          const dueAt = effectiveDueAt(rule);
          const occurrenceResult = await reminders.createOccurrenceIfNotExists({
            id: createId(),
            ruleId: rule.id,
            riderId: rule.riderId,
            motorcycleId: rule.motorcycleId,
            dueAt,
            status: "due",
            createdAt: now
          });
          const { occurrence } = occurrenceResult;
          if (occurrenceResult.created) {
            result.generated += 1;
            await appendWorkerAuditOutbox({
              action: "reminder.job.generated",
              rule,
              occurrenceId: occurrence.id,
              dueAt,
              audit,
              outbox,
              now,
              createId
            });
          }

          if (occurrence.status !== "sent") {
            await reminders.updateOccurrenceStatus({
              id: occurrence.id,
              status: "sent",
              processedAt: now,
              retryCount: occurrence.status === "failed" ? occurrence.retryCount + 1 : occurrence.retryCount
            });
            result.sent += 1;
            await appendWorkerAuditOutbox({
              action: "reminder.job.sent",
              rule,
              occurrenceId: occurrence.id,
              dueAt,
              audit,
              outbox,
              now,
              createId
            });
          }

          await reminders.completeRuleClaim({
            id: rule.id,
            nextDueAt: rule.intervalDays ? nextRecurringDueAt(dueAt, rule.intervalDays, now) : undefined,
            enabled: rule.intervalDays ? true : false,
            lastCompletedAt: now,
            updatedAt: now
          });
        } catch {
          result.failed += 1;
          await reminders.failRuleClaim({ id: rule.id, updatedAt: now });
        }
      }

      return result;
    });
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

async function appendWorkerAuditOutbox(input: {
  action: string;
  rule: ReminderRule;
  occurrenceId: string;
  dueAt: Date;
  audit: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["audit"];
  outbox: Parameters<Parameters<UnitOfWork["execute"]>[0]>[0]["outbox"];
  now: Date;
  createId: () => string;
}): Promise<void> {
  const eventId = input.createId();
  const payload = {
    resource_id: input.occurrenceId,
    reminder_id: input.rule.id,
    rider_id: input.rule.riderId,
    motorcycle_id: input.rule.motorcycleId,
    due_at: input.dueAt.toISOString()
  };
  await input.outbox.append({
    id: eventId,
    topic: input.action,
    aggregateType: "reminder_occurrence",
    aggregateId: input.occurrenceId,
    dedupeKey: `${input.action}:${input.occurrenceId}`,
    payload,
    createdAt: input.now,
    nextAttemptAt: input.now
  });
  await input.audit.append({
    id: input.createId(),
    action: input.action,
    entityType: "reminder_occurrence",
    entityId: input.occurrenceId,
    requestId: input.occurrenceId,
    metadata: payload,
    createdAt: input.now
  });
}
