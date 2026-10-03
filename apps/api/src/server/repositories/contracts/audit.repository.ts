import type { JsonObject } from "./idempotency.repository";
import type { ListFilter } from "@/lib/list-pagination";

export type AuditFilter = ListFilter & { actorId?: string; entityType?: string; entityId?: string; action?: string; adminOnly?: boolean };

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
  query(input: AuditFilter): Promise<AuditLog[]>;
  append(log: AppendAuditLog): Promise<AuditLog>;
}
