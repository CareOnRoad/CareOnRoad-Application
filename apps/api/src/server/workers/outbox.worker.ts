import { randomUUID } from "node:crypto";

import {
  applyOutboxDeliveryFailure,
  applyOutboxDeliverySuccess,
  deliverOutboxEvent,
  type OutboxConsumerDependencies
} from "@/features/outbox/outbox-consumers";
import { normalizeErrorCode } from "@/features/notifications/notification.service";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LEASE_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

export type OutboxWorkerResult = {
  claimed: number;
  processed: number;
  retried: number;
  deadLettered: number;
  leaseLost?: number;
};

export class OutboxWorker {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: {
      now?: () => Date;
      createId?: () => string;
      workerId?: string;
      batchSize?: number;
      leaseMs?: number;
      maxAttempts?: number;
      backoffMs?: number;
      consumers?: OutboxConsumerDependencies;
    } = {}
  ) {}

  async processBatch(): Promise<OutboxWorkerResult> {
    const workerId = `${this.options.workerId ?? "outbox-worker"}:${randomUUID()}`;
    const leaseMs = this.options.leaseMs ?? DEFAULT_LEASE_MS;
    const result: OutboxWorkerResult = { claimed: 0, processed: 0, retried: 0, deadLettered: 0 };
    for (let index = 0; index < (this.options.batchSize ?? DEFAULT_BATCH_SIZE); index++) {
      const claimedAt = this.options.now?.() ?? new Date();
      const [event] = await this.unitOfWork.execute(({ outbox }) => outbox.claim({
        now: claimedAt, leaseOwner: workerId, leaseUntil: new Date(claimedAt.getTime() + leaseMs), limit: 1
      }));
      if (!event) break;
      result.claimed++;
      let lostLease = false;
      let renewal = Promise.resolve();
      const timer = setInterval(() => {
        renewal = renewal.then(async () => {
          const time = this.options.now?.() ?? new Date();
          const held = await this.unitOfWork.execute(({ outbox }) => outbox.renewLease({
            id: event.id, leaseOwner: workerId, now: time, leaseUntil: new Date(time.getTime() + leaseMs)
          }));
          if (!held) lostLease = true;
        }).catch(() => { lostLease = true; });
      }, Math.max(10, Math.floor(leaseMs / 3)));
      try {
        const deliveryResult = await deliverOutboxEvent(event, this.options.consumers);
        clearInterval(timer);
        await renewal;
        if (lostLease) { result.leaseLost = (result.leaseLost ?? 0) + 1; continue; }
        const now = this.options.now?.() ?? new Date();
        await this.unitOfWork.execute(async (repositories) => {
          await repositories.outbox.markProcessed({
            id: event.id,
            leaseOwner: workerId,
            processedAt: now
          });
          await applyOutboxDeliverySuccess({
            event,
            repositories,
            processedAt: now,
            deliveryResult,
            createId: this.options.createId
          });
        });
        result.processed += 1;
      } catch (error) {
        clearInterval(timer);
        await renewal;
        if (lostLease || (error instanceof Error && error.message === "OUTBOX_LEASE_LOST")) {
          result.leaseLost = (result.leaseLost ?? 0) + 1;
          continue;
        }
        const now = this.options.now?.() ?? new Date();
        const errorCode = deliveryErrorCode(error);
        const deadLetter = event.attemptCount >= (this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
        const nextAttemptAt = new Date(
          Math.max(retryAfterTimestamp(error), now.getTime() +
            calculateBackoffMs(
              event.attemptCount,
              this.options.backoffMs ?? DEFAULT_BACKOFF_MS
            ))
        );
        try { await this.unitOfWork.execute(async (repositories) => {
          await repositories.outbox.markFailed({
            id: event.id,
            leaseOwner: workerId,
            errorCode,
            nextAttemptAt,
            deadLetter
          });
          await applyOutboxDeliveryFailure({
            event,
            repositories,
            failedAt: now,
            errorCode,
            createId: this.options.createId
          });
        }); } catch (failure) {
          if (failure instanceof Error && failure.message === "OUTBOX_LEASE_LOST") {
            result.leaseLost = (result.leaseLost ?? 0) + 1;
            continue;
          }
          throw failure;
        }
        if (deadLetter) {
          result.deadLettered += 1;
        } else {
          result.retried += 1;
        }
      } finally {
        clearInterval(timer);
      }
    }
    return result;
  }
}

export function calculateBackoffMs(attemptCount: number, baseMs: number): number {
  const exponent = Math.max(0, attemptCount - 1);
  return Math.min(MAX_BACKOFF_MS, baseMs * 2 ** exponent);
}

function deliveryErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "errorCode" in error &&
    typeof error.errorCode === "string"
  ) {
    return normalizeErrorCode(error.errorCode);
  }
  return "DELIVERY_FAILED";
}

function retryAfterTimestamp(error: unknown): number {
  return error && typeof error === "object" && "retryAfter" in error && error.retryAfter instanceof Date
    ? error.retryAfter.getTime() : 0;
}
