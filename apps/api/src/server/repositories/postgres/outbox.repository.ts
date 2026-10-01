import type { TransactionSql } from "postgres";

import type { JsonObject } from "../contracts/idempotency.repository";
import type { AppendOutboxEvent, OutboxEvent, OutboxRepository, OutboxStatus } from "../contracts/outbox.repository";

type OutboxRow = {
  id: string;
  topic: string;
  aggregate_type: string;
  aggregate_id: string;
  dedupe_key: string;
  payload: JsonObject;
  status: OutboxStatus;
  attempt_count: number;
  next_attempt_at: Date;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  last_error_code: string | null;
  created_at: Date;
  processed_at: Date | null;
};

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly sql: TransactionSql) {}

  async renewLease(input: Parameters<OutboxRepository["renewLease"]>[0]) {
    const rows = await this.sql`update outbox_events set lease_expires_at = ${input.leaseUntil}
      where id = ${input.id} and status = 'processing' and lease_owner = ${input.leaseOwner}
        and lease_expires_at > ${input.now} returning id`;
    return rows.length === 1;
  }

  async append(input: AppendOutboxEvent): Promise<OutboxEvent> {
    const rows = await this.sql<OutboxRow[]>`
      insert into outbox_events (
        id, topic, aggregate_type, aggregate_id, dedupe_key, payload, status,
        attempt_count, next_attempt_at, lease_owner, lease_expires_at,
        last_error_code, created_at, processed_at
      ) values (
        ${input.id}, ${input.topic}, ${input.aggregateType}, ${input.aggregateId},
        ${input.dedupeKey}, ${this.sql.json(
          input.payload as Parameters<TransactionSql["json"]>[0]
        )}, ${input.status ?? "pending"},
        ${input.attemptCount ?? 0}, ${input.nextAttemptAt ?? new Date()},
        ${input.leaseOwner ?? null}, ${input.leaseExpiresAt ?? null},
        ${input.lastErrorCode ?? null}, ${input.createdAt ?? new Date()},
        ${input.processedAt ?? null}
      )
      returning *
    `;
    return mapOutboxRow(rows[0]!);
  }

  async findByDedupeKey(dedupeKey: string): Promise<OutboxEvent | undefined> {
    const rows = await this.sql<OutboxRow[]>`
      select * from outbox_events where dedupe_key = ${dedupeKey} limit 1
    `;
    return rows[0] ? mapOutboxRow(rows[0]) : undefined;
  }

  async claim(input: {
    now: Date;
    leaseOwner: string;
    leaseUntil: Date;
    limit: number;
  }): Promise<OutboxEvent[]> {
    const rows = await this.sql<OutboxRow[]>`
      with claimable as (
        select id
        from outbox_events
        where (
          status = 'pending' and next_attempt_at <= ${input.now}
        ) or (
          status = 'processing' and lease_expires_at <= ${input.now}
        )
        order by next_attempt_at, created_at, id
        for update skip locked
        limit ${input.limit}
      )
      update outbox_events event
      set status = 'processing',
          attempt_count = event.attempt_count + 1,
          lease_owner = ${input.leaseOwner},
          lease_expires_at = ${input.leaseUntil},
          processed_at = null
      from claimable
      where event.id = claimable.id
      returning event.*
    `;
    return rows.map(mapOutboxRow);
  }

  async markProcessed(input: {
    id: string;
    leaseOwner: string;
    processedAt: Date;
  }): Promise<OutboxEvent> {
    const rows = await this.sql<OutboxRow[]>`
      update outbox_events
      set status = 'processed', processed_at = ${input.processedAt},
          lease_owner = null, lease_expires_at = null, last_error_code = null
      where id = ${input.id}
        and status = 'processing'
        and lease_owner = ${input.leaseOwner}
      returning *
    `;
    return requireOutboxRow(rows[0]);
  }

  async markFailed(input: {
    id: string;
    leaseOwner: string;
    errorCode: string;
    nextAttemptAt: Date;
    deadLetter: boolean;
  }): Promise<OutboxEvent> {
    const rows = await this.sql<OutboxRow[]>`
      update outbox_events
      set status = ${input.deadLetter ? "dead_letter" : "pending"}::outbox_status,
          next_attempt_at = ${input.nextAttemptAt},
          lease_owner = null,
          lease_expires_at = null,
          last_error_code = ${input.errorCode},
          processed_at = null
      where id = ${input.id}
        and status = 'processing'
        and lease_owner = ${input.leaseOwner}
      returning *
    `;
    return requireOutboxRow(rows[0]);
  }
}

function requireOutboxRow(row: OutboxRow | undefined): OutboxEvent {
  if (!row) {
    throw new Error("OUTBOX_LEASE_LOST");
  }
  return mapOutboxRow(row);
}

function mapOutboxRow(row: OutboxRow): OutboxEvent {
  return {
    id: row.id,
    topic: row.topic,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    dedupeKey: row.dedupe_key,
    payload: row.payload,
    status: row.status,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    leaseOwner: row.lease_owner ?? undefined,
    leaseExpiresAt: row.lease_expires_at ?? undefined,
    lastErrorCode: row.last_error_code ?? undefined,
    createdAt: row.created_at,
    processedAt: row.processed_at ?? undefined
  };
}
