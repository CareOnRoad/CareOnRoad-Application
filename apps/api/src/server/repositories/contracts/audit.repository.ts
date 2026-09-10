import type { JsonObject } from "./idempotency.repository";

export type AuditActorRole = "rider" | "mechanic" | "admin";

export type AuditLog = {
  id: string;
  actorId?: string;
  actorRole?: AuditActorRole;
  action: string;
  entityType: string;
  entityId?: string;
  requestId?: string;
  adminReason?: string;
  metadata: JsonObject;
  createdAt: Date;
};

export type AppendAuditLog = Omit<AuditLog, "createdAt"> & {
  createdAt?: Date;
};

export interface AuditRepository {
  append(log: AppendAuditLog): Promise<AuditLog>;
}
