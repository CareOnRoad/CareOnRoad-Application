import { filterPage } from "@/lib/list-pagination";
import type {
  AppendOutboxEvent,
  OutboxEvent,
  OutboxRepository
} from "../contracts/outbox.repository";

export class InMemoryOutboxRepository implements OutboxRepository {
  constructor(private readonly events: OutboxEvent[]) {}

  async findById(id: string) { return this.events.find((row) => row.id === id); }
  async findByIdForUpdate(id: string) { return this.findById(id); }
  async listAdmin(input: Parameters<OutboxRepository["listAdmin"]>[0]) { return filterPage(this.events.filter((row) => !input.topic || row.topic === input.topic), input); }
  async recover(input: Parameters<OutboxRepository["recover"]>[0]) {
    const row = await this.findById(input.id); const retry = input.action === "retry";
    if (!row || (row.leaseExpiresAt && row.leaseExpiresAt > input.now) ||
      (retry ? !["dead_letter", "processed"].includes(row.status) || (row.adminRetryCount ?? 0) >= 3 : !["pending", "dead_letter", "processing"].includes(row.status))) return undefined;
    Object.assign(row, { status: retry ? "pending" : "abandoned", attemptCount: retry ? 0 : row.attemptCount, nextAttemptAt: input.now,
      leaseOwner: undefined, leaseExpiresAt: undefined, processedAt: undefined, lastErrorCode: undefined,
      adminRetryCount: (row.adminRetryCount ?? 0) + (retry ? 1 : 0), abandonedAt: retry ? undefined : input.now }); return row;
  }

  async renewLease(input: Parameters<OutboxRepository["renewLease"]>[0]) {
    const event = this.events.find((item) => item.id === input.id && item.status === "processing" &&
      item.leaseOwner === input.leaseOwner && item.leaseExpiresAt && item.leaseExpiresAt > input.now);
    if (!event) return false;
    event.leaseExpiresAt = input.leaseUntil;
    return true;
  }

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
