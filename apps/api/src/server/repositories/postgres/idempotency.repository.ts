import type { TransactionSql } from "postgres";

import type {
  CompleteIdempotencyRecord,
  CreateIdempotencyRecord,
  IdempotencyRecord,
  IdempotencyRepository,
  JsonObject
} from "../contracts/idempotency.repository";

type IdempotencyRow = {
  id: string;
  actor_id: string;
  scope: string;
  idempotency_key: string;
  request_hash: string;
  response_status: number | null;
  response_body: JsonObject | null;
  resource_type: string | null;
  resource_id: string | null;
  expires_at: Date;
  created_at: Date;
  completed_at: Date | null;
};

export class PostgresIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly sql: TransactionSql) {}

  async find(
    actorId: string,
    scope: string,
    idempotencyKey: string
  ): Promise<IdempotencyRecord | undefined> {
    // A missing row cannot be locked. Serialize this actor/scope/key before
    // reading it in a fresh statement snapshot, including the first creation.
    await this.sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([actorId, scope, idempotencyKey])}, 0))`;
    const rows = await this.sql<IdempotencyRow[]>`
      select *
      from idempotency_records
      where actor_id = ${actorId}
        and scope = ${scope}
        and idempotency_key = ${idempotencyKey}
      limit 1
    `;
    return rows[0] ? mapIdempotencyRow(rows[0]) : undefined;
  }

  async create(input: CreateIdempotencyRecord): Promise<IdempotencyRecord> {
    const rows = await this.sql<IdempotencyRow[]>`
      insert into idempotency_records (
        id, actor_id, scope, idempotency_key, request_hash, expires_at, created_at
      ) values (
        ${input.id}, ${input.actorId}, ${input.scope}, ${input.idempotencyKey},
        ${input.requestHash}, ${input.expiresAt}, ${input.createdAt ?? new Date()}
      )
      returning *
    `;
    return mapIdempotencyRow(rows[0]!);
  }

  async complete(input: CompleteIdempotencyRecord): Promise<IdempotencyRecord> {
    const rows = await this.sql<IdempotencyRow[]>`
      update idempotency_records
      set response_status = ${input.responseStatus},
          response_body = ${this.sql.json(
            input.responseBody as Parameters<TransactionSql["json"]>[0]
          )},
          resource_type = ${input.resourceType ?? null},
          resource_id = ${input.resourceId ?? null},
          completed_at = ${input.completedAt ?? new Date()}
      where actor_id = ${input.actorId}
        and scope = ${input.scope}
        and idempotency_key = ${input.idempotencyKey}
      returning *
    `;
    if (!rows[0]) {
      throw new Error("IDEMPOTENCY_RECORD_NOT_FOUND");
    }
    return mapIdempotencyRow(rows[0]);
  }
}

function mapIdempotencyRow(row: IdempotencyRow): IdempotencyRecord {
  return {
    id: row.id,
    actorId: row.actor_id,
    scope: row.scope,
    idempotencyKey: row.idempotency_key,
    requestHash: row.request_hash,
    responseStatus: row.response_status ?? undefined,
    responseBody: row.response_body ?? undefined,
    resourceType: row.resource_type ?? undefined,
    resourceId: row.resource_id ?? undefined,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined
  };
}
