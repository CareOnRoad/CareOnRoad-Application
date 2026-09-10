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
    const now = this.options.now?.() ?? new Date();
    const workerId = this.options.workerId ?? `outbox-worker-${randomUUID()}`;
    const leaseUntil = new Date(now.getTime() + (this.options.leaseMs ?? DEFAULT_LEASE_MS));
    const events = await this.unitOfWork.execute(({ outbox }) =>
      outbox.claim({
        now,
        leaseOwner: workerId,
        leaseUntil,
        limit: this.options.batchSize ?? DEFAULT_BATCH_SIZE
      })
    );
    const result: OutboxWorkerResult = {
      claimed: events.length,
      processed: 0,
      retried: 0,
      deadLettered: 0
    };

    for (const event of events) {
      try {
        const deliveryResult = await deliverOutboxEvent(event, this.options.consumers);
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
        const errorCode = deliveryErrorCode(error);
        const deadLetter = event.attemptCount >= (this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
        const nextAttemptAt = new Date(
          now.getTime() +
            calculateBackoffMs(
              event.attemptCount,
              this.options.backoffMs ?? DEFAULT_BACKOFF_MS
            )
        );
        await this.unitOfWork.execute(async (repositories) => {
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
        });
        if (deadLetter) {
          result.deadLettered += 1;
        } else {
          result.retried += 1;
        }
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
