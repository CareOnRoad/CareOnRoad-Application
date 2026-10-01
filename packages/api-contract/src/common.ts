import { z } from "zod";

/**
 * Error body returned by every `/api/v1` route. Mirrors
 * `apps/api/src/lib/api-error.ts`.
 */
export const apiErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "INVALID_TOKEN",
  "ACTOR_SUSPENDED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "DATABASE_CONFLICT",
  "DATABASE_CONSTRAINT_VIOLATION",
  "DATABASE_UNAVAILABLE",
  "DATABASE_ERROR",
  "PROVIDER_ERROR"
]);

export const apiErrorBodySchema = z.object({
  error_code: apiErrorCodeSchema,
  message: z.string(),
  request_id: z.string().optional(),
  details: z.unknown().optional()
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/**
 * Cursor page envelope used by every paginated admin list response. Mirrors
 * `AdminPageResponse<T>` in the backend services.
 */
export const pageMetaSchema = z.object({
  limit: z.number().int().positive(),
  has_more: z.boolean(),
  next_cursor: z.string().optional()
});

export const cursorPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), page: pageMetaSchema });

export type PageMeta = z.infer<typeof pageMetaSchema>;

/** Administrative reason bounds enforced on every admin mutation. */
export const ADMIN_REASON_MIN_LENGTH = 10;
export const ADMIN_REASON_MAX_LENGTH = 500;
export const ADMIN_PAGE_DEFAULT_LIMIT = 50;
export const ADMIN_PAGE_MAX_LIMIT = 100;

export const adminReasonValueSchema = z
  .string()
  .trim()
  .min(ADMIN_REASON_MIN_LENGTH)
  .max(ADMIN_REASON_MAX_LENGTH);

export const adminReasonSchema = z.object({ reason: adminReasonValueSchema }).strict();

export const adminUuidSchema = z.string().uuid();

export const adminIdempotencyKeySchema = z.string().trim().min(8).max(200);
