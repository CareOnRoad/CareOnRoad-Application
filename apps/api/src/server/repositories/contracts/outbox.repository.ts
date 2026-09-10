import type { JsonObject } from "./idempotency.repository";

export type OutboxStatus = "pending" | "processing" | "processed" | "dead_letter";

export type OutboxEvent = {
  id: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  dedupeKey: string;
  payload: JsonObject;
  status: OutboxStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  lastErrorCode?: string;
  createdAt: Date;
  processedAt?: Date;
};

export type AppendOutboxEvent = Pick<
  OutboxEvent,
  "id" | "topic" | "aggregateType" | "aggregateId" | "dedupeKey" | "payload"
> &
  Partial<
    Pick<
      OutboxEvent,
      | "status"
      | "attemptCount"
      | "nextAttemptAt"
      | "leaseOwner"
      | "leaseExpiresAt"
      | "lastErrorCode"
      | "createdAt"
      | "processedAt"
    >
  >;

export interface OutboxRepository {
  append(event: AppendOutboxEvent): Promise<OutboxEvent>;
  findByDedupeKey(dedupeKey: string): Promise<OutboxEvent | undefined>;
  claim(input: {
    now: Date;
    leaseOwner: string;
    leaseUntil: Date;
    limit: number;
  }): Promise<OutboxEvent[]>;
  markProcessed(input: {
    id: string;
    leaseOwner: string;
    processedAt: Date;
  }): Promise<OutboxEvent>;
  markFailed(input: {
    id: string;
    leaseOwner: string;
    errorCode: string;
    nextAttemptAt: Date;
    deadLetter: boolean;
  }): Promise<OutboxEvent>;
}
