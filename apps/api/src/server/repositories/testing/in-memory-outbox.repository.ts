import type {
  AppendOutboxEvent,
  OutboxEvent,
  OutboxRepository
} from "../contracts/outbox.repository";

export class InMemoryOutboxRepository implements OutboxRepository {
  constructor(private readonly events: OutboxEvent[]) {}

  async append(input: AppendOutboxEvent): Promise<OutboxEvent> {
    if (await this.findByDedupeKey(input.dedupeKey)) {
      throw new Error("OUTBOX_DEDUPE_KEY_EXISTS");
    }

    const event: OutboxEvent = {
      ...input,
      status: input.status ?? "pending",
      attemptCount: input.attemptCount ?? 0,
      nextAttemptAt: input.nextAttemptAt ?? new Date(),
      createdAt: input.createdAt ?? new Date()
    };
    this.events.push(event);
    return event;
  }

  async findByDedupeKey(dedupeKey: string): Promise<OutboxEvent | undefined> {
    return this.events.find((event) => event.dedupeKey === dedupeKey);
  }

  async claim(input: {
    now: Date;
    leaseOwner: string;
    leaseUntil: Date;
    limit: number;
  }): Promise<OutboxEvent[]> {
    return this.events
      .filter(
        (event) =>
          (event.status === "pending" && event.nextAttemptAt <= input.now) ||
          (event.status === "processing" &&
            event.leaseExpiresAt !== undefined &&
            event.leaseExpiresAt <= input.now)
      )
      .sort(
        (left, right) =>
          left.nextAttemptAt.getTime() - right.nextAttemptAt.getTime() ||
          left.createdAt.getTime() - right.createdAt.getTime() ||
          left.id.localeCompare(right.id)
      )
      .slice(0, input.limit)
      .map((event) => {
        event.status = "processing";
        event.attemptCount += 1;
        event.leaseOwner = input.leaseOwner;
        event.leaseExpiresAt = input.leaseUntil;
        event.processedAt = undefined;
        return event;
      });
  }

  async markProcessed(input: {
    id: string;
    leaseOwner: string;
    processedAt: Date;
  }): Promise<OutboxEvent> {
    const event = this.requireLease(input.id, input.leaseOwner);
    event.status = "processed";
    event.processedAt = input.processedAt;
    event.leaseOwner = undefined;
    event.leaseExpiresAt = undefined;
    event.lastErrorCode = undefined;
    return event;
  }

  async markFailed(input: {
    id: string;
    leaseOwner: string;
    errorCode: string;
    nextAttemptAt: Date;
    deadLetter: boolean;
  }): Promise<OutboxEvent> {
    const event = this.requireLease(input.id, input.leaseOwner);
    event.status = input.deadLetter ? "dead_letter" : "pending";
    event.nextAttemptAt = input.nextAttemptAt;
    event.leaseOwner = undefined;
    event.leaseExpiresAt = undefined;
    event.lastErrorCode = input.errorCode;
    event.processedAt = undefined;
    return event;
  }

  private requireLease(id: string, leaseOwner: string): OutboxEvent {
    const event = this.events.find(
      (item) =>
        item.id === id && item.status === "processing" && item.leaseOwner === leaseOwner
    );
    if (!event) {
      throw new Error("OUTBOX_LEASE_LOST");
    }
    return event;
  }
}
