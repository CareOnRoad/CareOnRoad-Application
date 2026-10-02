import type { TransactionSql } from "postgres";

import { sanitizeAuditMetadata } from "@/features/audit/audit-sanitizer";
import { sanitizeAdminReason } from "@/features/admin/admin-redaction";

import type {
  AppendAuditLog,
  AuditActorRole,
  AuditLog,
  AuditRepository
} from "../contracts/audit.repository";
import type { JsonObject } from "../contracts/idempotency.repository";

type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_role: AuditActorRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  request_id: string | null;
  admin_reason: string | null;
  metadata: JsonObject;
  created_at: Date;
};

export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly sql: TransactionSql) {}

  async query(input: import("../contracts/audit.repository").AuditFilter): Promise<AuditLog[]> {
    await this.sql`select set_config('statement_timeout', '5000', true)`;
    const rows = await this.sql<AuditRow[]>`select * from audit_logs
      where (${input.actorId ?? null}::uuid is null or actor_id = ${input.actorId ?? null}::uuid)
        and (${input.entityType ?? null}::text is null or entity_type = ${input.entityType ?? null})
        and (${input.entityId ?? null}::uuid is null or entity_id = ${input.entityId ?? null}::uuid)
        and (${input.action ?? null}::text is null or action = ${input.action ?? null})
        and (${!input.adminOnly} or actor_role = 'admin')
        and (${input.date_from ?? null}::timestamptz is null or created_at >= ${input.date_from ?? null}::timestamptz)
        and (${input.date_to ?? null}::timestamptz is null or created_at <= ${input.date_to ?? null}::timestamptz)
        and (${input.cursor?.timestamp ?? null}::timestamptz is null or (date_trunc('milliseconds', created_at), id) < (${input.cursor?.timestamp ?? null}::timestamptz, ${input.cursor?.id ?? null}::uuid))
      order by date_trunc('milliseconds', created_at) desc, id desc limit ${input.limit + 1}`;
    return rows.map(mapAuditRow);
  }

  async append(input: AppendAuditLog): Promise<AuditLog> {
    const metadata = sanitizeAuditMetadata(input.metadata);
    const rows =
      input.adminReason === undefined
        ? await this.sql<AuditRow[]>`
            insert into audit_logs (
              id, actor_id, actor_role, action, entity_type, entity_id,
              request_id, metadata, created_at
            ) values (
              ${input.id}, ${input.actorId ?? null}, ${input.actorRole ?? null},
              ${input.action}, ${input.entityType}, ${input.entityId ?? null},
              ${input.requestId ?? null}, ${this.sql.json(
                metadata as Parameters<TransactionSql["json"]>[0]
              )}, ${input.createdAt ?? new Date()}
            )
            returning *, null::text as admin_reason
          `
        : await this.sql<AuditRow[]>`
            insert into audit_logs (
              id, actor_id, actor_role, action, entity_type, entity_id,
              request_id, admin_reason, metadata, created_at
            ) values (
              ${input.id}, ${input.actorId ?? null}, ${input.actorRole ?? null},
              ${input.action}, ${input.entityType}, ${input.entityId ?? null},
              ${input.requestId ?? null}, ${sanitizeAdminReason(input.adminReason)}, ${this.sql.json(
                metadata as Parameters<TransactionSql["json"]>[0]
              )}, ${input.createdAt ?? new Date()}
            )
            returning *
          `;
    return mapAuditRow(rows[0]!);
  }
}

function mapAuditRow(row: AuditRow): AuditLog {
  return {
    id: row.id,
    actorId: row.actor_id ?? undefined,
    actorRole: row.actor_role ?? undefined,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    requestId: row.request_id ?? undefined,
    adminReason: row.admin_reason ?? undefined,
    metadata: row.metadata,
    createdAt: row.created_at
  };
}
