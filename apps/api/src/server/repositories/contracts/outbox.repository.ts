import type { JsonObject } from "./idempotency.repository";

export type OutboxStatus = "pending" | "processing" | "processed" | "dead_letter" | "abandoned";

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
  adminRetryCount?: number;
  abandonedAt?: Date;
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
  findById(id: string): Promise<OutboxEvent | undefined>;
  findByIdForUpdate(id: string): Promise<OutboxEvent | undefined>;
  listAdmin(input: import("@/lib/list-pagination").ListFilter & { topic?: string }): Promise<OutboxEvent[]>;
  recover(input: { id: string; action: "retry" | "abandon"; actorId: string; reason: string; now: Date }): Promise<OutboxEvent | undefined>;
  renewLease(input: { id: string; leaseOwner: string; now: Date; leaseUntil: Date }): Promise<boolean>;
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
