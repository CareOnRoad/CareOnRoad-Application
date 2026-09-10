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
