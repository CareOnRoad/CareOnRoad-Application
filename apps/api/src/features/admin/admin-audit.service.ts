import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { sanitizeAuditMetadata } from "@/features/audit/audit-sanitizer";
import { listQuerySchema, toPage } from "@/lib/list-pagination";
import type { AuditLog } from "@/server/repositories/contracts/audit.repository";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import { loadActiveAdminActor } from "./admin.authorization";
import { boundedWindow } from "./admin-delivery.service";
import { AdminRouteError } from "./admin-route-helpers";

const filterFields = { actor_id: z.string().uuid().optional(), entity_id: z.string().uuid().optional(),
  entity_type: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/).optional(), action: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() };
const querySchema = listQuerySchema.omit({ date_from: true, date_to: true }).extend(filterFields);
const exportSchema = z.object({ ...filterFields, limit: z.coerce.number().int().min(1).max(10_000).default(1000) }).strict();

export class AdminAuditService {
  constructor(private readonly unitOfWork: UnitOfWork, private readonly options: { now?: () => Date; createId?: () => string } = {}) {}
  async read(identity: VerifiedSupabaseIdentity, input: unknown = {}, mode: "query" | "admin_actions" | "export" = "query") {
    const parsed = (mode === "export" ? exportSchema : querySchema).safeParse(input);
    if (!parsed.success) throw new AdminRouteError("INVALID_INPUT", "Audit filters are invalid.", 400);
    const now = this.options.now?.() ?? new Date(); const body = parsed.data;
    const filter = { limit: body.limit, actorId: body.actor_id, entityId: body.entity_id, entityType: body.entity_type, action: body.action,
      adminOnly: mode === "admin_actions", ...boundedWindow(body, now), cursor: mode === "export" ? undefined : (body as z.infer<typeof querySchema>).cursor };
    return this.unitOfWork.execute(async (repositories) => {
      const actor = await loadActiveAdminActor(identity, repositories.users);
      const rows = await repositories.audit.query(filter);
      if (mode !== "export") return toPage(rows, body.limit, safeAudit);
      const items = rows.slice(0, body.limit).map(safeAudit);
      await loadActiveAdminActor(identity, repositories.users);
      const filterHash = createHash("sha256").update(JSON.stringify(filter)).digest("hex");
      await repositories.audit.append({ id: (this.options.createId ?? randomUUID)(), actorId: actor.id, actorRole: "admin", action: "admin.audit.exported", entityType: "audit_export",
        metadata: { filter_hash: filterHash, exported_count: items.length }, createdAt: now });
      return { items, exported_at: now.toISOString(), exported_count: items.length, has_more: rows.length > body.limit };
    });
  }
}

export function safeAudit(row: AuditLog) {
  const metadata = sanitizeAuditMetadata(row.metadata);
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key.endsWith("_id") && typeof value === "string" && z.string().uuid().safeParse(value).success) safe[key] = value;
    else if (key === "filter_hash" && typeof value === "string" && /^[a-f0-9]{64}$/.test(value)) safe[key] = value;
    else if (["exported_count", "attempt_count", "checklist_revision", "safety_check_count"].includes(key) && typeof value === "number" && Number.isSafeInteger(value) && value >= 0) safe[key] = value;
    else if (["status", "previous_status", "next_status", "new_status", "role", "service_type", "field"].includes(key) && typeof value === "string" &&
      ["pending", "processing", "processed", "dead_letter", "abandoned", "sent", "failed", "canceled", "accepted", "en_route", "on_site", "diagnosis", "quoted", "awaiting_payment", "in_progress", "completed", "recovery_canceled", "approved", "rejected", "voided", "expired", "superseded", "active", "suspended", "archived", "rider", "mechanic", "admin", "mobile_repair", "emergency_rescue", "periodic_maintenance", "at_home_service", "other", "display_name"].includes(value)) safe[key] = value;
  }
  return { id: row.id, actor_id: row.actorId, actor_role: row.actorRole, action: /^[a-zA-Z][a-zA-Z0-9_.-]{0,199}$/.test(row.action) ? row.action : "unknown.action", entity_type: /^[a-zA-Z][a-zA-Z0-9_.-]{0,99}$/.test(row.entityType) ? row.entityType : "unknown", entity_id: row.entityId,
    request_id: row.requestId && z.string().uuid().safeParse(row.requestId).success ? row.requestId : undefined,
    has_admin_reason: Boolean(row.adminReason), metadata: safe, created_at: row.createdAt.toISOString() };
}
