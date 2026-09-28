import { z } from "zod";

import { cursorPageSchema, adminReasonSchema, adminUuidSchema } from "./common";
import { userRoles, userStatuses } from "./enums";

/**
 * Response schemas for `/api/v1/admin/users/**`.
 *
 * Shapes mirror `AdminUserManagementService` in
 * `apps/api/src/features/admin/admin-user-management.service.ts`.
 */

/** `AdminUserSummaryResponse` (service lines 27-39). */
export const adminUserSummarySchema = z.object({
  id: z.string(),
  display_name: z.string().optional(),
  phone_masked: z.string().optional(),
  status: z.enum(userStatuses),
  roles: z.array(z.enum(userRoles)),
  device_summary: z.object({
    total: z.number().int().nonnegative(),
    enabled: z.number().int().nonnegative()
  }),
  created_at: z.string(),
  updated_at: z.string()
});

/** `AdminUserDeviceResponse` (service lines 41-50). */
export const adminUserDeviceSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  device_key_fingerprint: z.string(),
  platform: z.string(),
  enabled: z.boolean(),
  last_registered_at: z.string(),
  created_at: z.string(),
  updated_at: z.string()
});

/**
 * `AdminUserActivityResponse` (service lines 52-61).
 *
 * `metadata` is already allow-listed server-side by `toActivityResponse`
 * (service lines 611-632), so the frontend can treat it as an opaque record.
 */
export const adminUserActivitySchema = z.object({
  id: z.string(),
  actor_id: z.string().optional(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().optional(),
  metadata: z.record(z.unknown()),
  occurred_at: z.string()
});

export const adminUserListResponseSchema = cursorPageSchema(adminUserSummarySchema);
export const adminUserDeviceListResponseSchema = cursorPageSchema(adminUserDeviceSchema);
export const adminUserActivityListResponseSchema = cursorPageSchema(adminUserActivitySchema);

export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;
export type AdminUserDevice = z.infer<typeof adminUserDeviceSchema>;
export type AdminUserActivity = z.infer<typeof adminUserActivitySchema>;
export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>;
export type AdminUserDeviceListResponse = z.infer<typeof adminUserDeviceListResponseSchema>;
export type AdminUserActivityListResponse = z.infer<typeof adminUserActivityListResponseSchema>;

/** `GET /api/v1/admin/users` query filters (`adminUserListFilterSchema`). */
export const adminUserListQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  query: z.string().trim().min(1).max(120).optional(),
  role: z.enum(userRoles).optional(),
  status: z.enum(userStatuses).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

/** `POST /api/v1/admin/users/[userId]/suspend|reactivate|archive` body. */
export const adminUserStatusMutationSchema = adminReasonSchema;

/** `POST /api/v1/admin/users/[userId]/roles/grant|revoke` body. */
export const adminRoleMutationSchema = z
  .object({
    reason: adminReasonSchema.shape.reason,
    role: z.enum(userRoles)
  })
  .strict();

/** `POST /api/v1/admin/users/[userId]/devices/[deviceId]/revoke` body. */
export const adminDeviceRevokeMutationSchema = adminReasonSchema;

export { adminUuidSchema };
