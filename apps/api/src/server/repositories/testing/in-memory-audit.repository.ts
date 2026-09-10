import { sanitizeAuditMetadata } from "@/features/audit/audit-sanitizer";
import { sanitizeAdminReason } from "@/features/admin/admin-redaction";

import type { AppendAuditLog, AuditLog, AuditRepository } from "../contracts/audit.repository";

export class InMemoryAuditRepository implements AuditRepository {
  constructor(private readonly logs: AuditLog[]) {}

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
