import { sanitizeAuditMetadata } from "@/features/audit/audit-sanitizer";
import { sanitizeAdminReason } from "@/features/admin/admin-redaction";
import { filterPage } from "@/lib/list-pagination";

import type { AppendAuditLog, AuditLog, AuditRepository } from "../contracts/audit.repository";

export class InMemoryAuditRepository implements AuditRepository {
  constructor(private readonly logs: AuditLog[]) {}

  async query(input: import("../contracts/audit.repository").AuditFilter): Promise<AuditLog[]> {
    return filterPage(this.logs.filter((row) => (!input.actorId || row.actorId === input.actorId) &&
      (!input.entityType || row.entityType === input.entityType) && (!input.entityId || row.entityId === input.entityId) &&
      (!input.action || row.action === input.action) && (!input.adminOnly || row.actorRole === "admin")), input);
  }

  async append(input: AppendAuditLog): Promise<AuditLog> {
    const log: AuditLog = {
      ...input,
      ...(input.adminReason
        ? { adminReason: sanitizeAdminReason(input.adminReason) }
        : {}),
      metadata: sanitizeAuditMetadata(input.metadata),
      createdAt: input.createdAt ?? new Date()
    };
    this.logs.push(log);
    return log;
  }
}
