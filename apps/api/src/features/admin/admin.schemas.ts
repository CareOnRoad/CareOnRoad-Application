import { z } from "zod";

import { serviceTypes, userRoles, userStatuses } from "@careonroad/api-contract/enums";

export const ADMIN_REASON_MIN_LENGTH = 10;
export const ADMIN_REASON_MAX_LENGTH = 500;
export const ADMIN_PAGE_DEFAULT_LIMIT = 50;
export const ADMIN_PAGE_MAX_LIMIT = 100;

export const adminReasonValueSchema = z
  .string()
  .trim()
  .min(ADMIN_REASON_MIN_LENGTH)
  .max(ADMIN_REASON_MAX_LENGTH);

export const adminReasonSchema = z
  .object({
    reason: adminReasonValueSchema
  })
  .strict();

export const adminUuidSchema = z.string().uuid();

export const adminCursorSchema = z.string().trim().min(1).max(500);

export const adminPaginationSchema = z
  .object({
    cursor: adminCursorSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(ADMIN_PAGE_MAX_LIMIT)
      .default(ADMIN_PAGE_DEFAULT_LIMIT)
  })
  .strict();

export const adminDateRangeSchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional()
  })
  .strict()
  .refine(
    ({ from, to }) => !from || !to || new Date(from).getTime() <= new Date(to).getTime(),
    {
      message: "The start date must not be after the end date.",
      path: ["to"]
    }
  );

export const adminRoleFilterSchema = z.enum(userRoles);
export const adminUserStatusFilterSchema = z.enum(userStatuses);

export const adminCommonFilterSchema = adminPaginationSchema
  .extend({
    query: z.string().trim().min(1).max(120).optional(),
    role: adminRoleFilterSchema.optional(),
    status: adminUserStatusFilterSchema.optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional()
  })
  .refine(
    ({ from, to }) => !from || !to || new Date(from).getTime() <= new Date(to).getTime(),
    {
      message: "The start date must not be after the end date.",
      path: ["to"]
    }
  );

export const adminUserListFilterSchema = adminCommonFilterSchema;

export const adminRoleMutationSchema = z
  .object({
    reason: adminReasonValueSchema,
    role: adminRoleFilterSchema
  })
  .strict();

export const adminMechanicProfileStatuses = [
  "pending",
  "active",
  "rejected",
  "suspended",
  "banned"
] as const;

const adminBooleanFilterSchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

export const adminMechanicListFilterSchema = adminPaginationSchema.extend({
  profile_status: z.enum(adminMechanicProfileStatuses).optional(),
  service_type: z.enum(serviceTypes).optional(),
  is_available: adminBooleanFilterSchema.optional(),
  location_freshness: z.enum(["fresh", "stale", "missing"]).optional(),
  work_state: z.enum(["idle", "active_assignment"]).optional()
});

export const adminMechanicSkillsMutationSchema = z
  .object({
    reason: adminReasonValueSchema,
    service_types: z
      .array(z.enum(serviceTypes))
      .min(1)
      .max(serviceTypes.length)
  })
  .strict();

export const adminMechanicRadiusMutationSchema = z
  .object({
    reason: adminReasonValueSchema,
    service_radius_km: z.number().positive().max(100)
  })
  .strict();

export const adminRequestStatuses = [
  "submitted",
  "dispatching",
  "offered",
  "assigned",
  "mechanic_en_route",
  "in_service",
  "awaiting_quote_approval",
  "awaiting_payment",
  "completed",
  "manual_escalation",
  "canceled"
] as const;

export const adminRequestPriorities = ["normal", "high", "emergency"] as const;

export const adminServiceRequestListFilterSchema = adminPaginationSchema
  .extend({
    status: z.enum(adminRequestStatuses).optional(),
    service_type: z.enum(serviceTypes).optional(),
    priority: z.enum(adminRequestPriorities).optional(),
    rider_id: adminUuidSchema.optional(),
    mechanic_id: adminUuidSchema.optional(),
    request_code: z.string().trim().min(1).max(40).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional()
  })
  .refine(
    ({ from, to }) =>
      !from || !to || new Date(from).getTime() <= new Date(to).getTime(),
    {
      message: "The start date must not be after the end date.",
      path: ["to"]
    }
  );

export const adminInternalNoteMutationSchema = z
  .object({
    reason: adminReasonValueSchema,
    note: z.string().trim().min(1).max(2000)
  })
  .strict();

export const adminIdempotencyKeySchema = z.string().trim().min(8).max(200);

export const adminCommandEnvelopeSchema = z
  .object({
    reason: adminReasonValueSchema,
    idempotencyKey: adminIdempotencyKeySchema
  })
  .strict();

export type AdminReasonInput = z.infer<typeof adminReasonSchema>;
export type AdminPaginationInput = z.infer<typeof adminPaginationSchema>;
export type AdminCommandEnvelope = z.infer<typeof adminCommandEnvelopeSchema>;
