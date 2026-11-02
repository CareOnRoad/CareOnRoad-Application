import { z } from "zod";

import { cursorPageSchema } from "./common";

/**
 * Response schemas for `/api/v1/admin/audit/**`.
 *
 * Shapes mirror `AdminAuditService` in
 * `apps/api/src/features/admin/admin-audit.service.ts` (`safeAudit` line 38).
 *
 * IMPORTANT — the audit trail is append-only in PostgreSQL
 * (`reject_audit_log_mutation()` trigger in migration
 * `202606250002`). The frontend must never offer a delete action for it.
 *
 * `metadata` is already allow-listed server-side by `safeAudit`, so it is an
 * opaque record here and must be rendered defensively.
 */

export const adminAuditRowSchema = z.object({
  id: z.string(),
  actor_id: z.string().nullish(),
  actor_role: z.string().nullish(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullish(),
  request_id: z.string().optional(),
  has_admin_reason: z.boolean(),
  metadata: z.record(z.unknown()),
  created_at: z.string()
});

export const adminAuditListResponseSchema = cursorPageSchema(adminAuditRowSchema);

/**
 * `GET /api/v1/admin/audit/export` (service lines 30-35) returns a plain
 * object, not a page envelope.
 */
export const adminAuditExportResponseSchema = z.object({
  items: z.array(adminAuditRowSchema),
  exported_at: z.string(),
  exported_count: z.number().int().nonnegative(),
  has_more: z.boolean()
});

export type AdminAuditRow = z.infer<typeof adminAuditRowSchema>;

/** Query for `GET /api/v1/admin/audit` and `/audit/admin-actions`. */
export const adminAuditQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  actor_id: z.string().uuid().optional(),
  entity_type: z.string().trim().min(1).max(100).optional(),
  entity_id: z.string().uuid().optional(),
  action: z.string().trim().min(1).max(200).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

/** Query for `GET /api/v1/admin/audit/export` (no cursor). */
export const adminAuditExportQuerySchema = adminAuditQuerySchema.omit({
  cursor: true
});
