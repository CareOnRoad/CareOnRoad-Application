import { z } from "zod";

import { cursorPageSchema, adminReasonValueSchema } from "./common";

/**
 * Response schemas for `/api/v1/admin/quotes/**` and the quote-related
 * supervision reads under `/api/v1/admin/service-requests/**`.
 *
 * Shapes mirror `AdminSupervisionService` in
 * `apps/api/src/features/admin/admin-supervision.service.ts` (`safeQuote`,
 * lines 118-122) and `safeAction` (lines 115-117).
 */

export const adminQuotePurposes = [
  "standard",
  "rescue_labor",
  "maintenance_labor",
  "materials",
  "additions"
] as const;

export const adminQuoteStatuses = [
  "pending",
  "approved",
  "rejected",
  "superseded",
  "expired",
  "voided"
] as const;

/** `safeQuote` (service lines 118-122). */
export const adminQuoteSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  assignment_id: z.string(),
  diagnosis_id: z.string().nullish(),
  purpose: z.string(),
  version: z.number().int(),
  status: z.string(),
  total_amount: z.number(),
  currency: z.string(),
  line_count: z.number().int().nonnegative(),
  expires_at: z.string().optional(),
  created_at: z.string(),
  responded_at: z.string().optional()
});

/** `safeAction` (service lines 115-117). */
export const adminQuoteSupervisionActionSchema = z.object({
  id: z.string(),
  admin_id: z.string(),
  request_id: z.string().optional(),
  assignment_id: z.string().optional(),
  quote_id: z.string().optional(),
  diagnosis_id: z.string().optional(),
  action: z.string(),
  created_at: z.string()
});

/**
 * `GET /api/v1/admin/quotes/[quoteId]` returns the quote plus its supervision
 * action log (`admin-supervision.service.ts:31`).
 */
export const adminQuoteDetailSchema = adminQuoteSchema.extend({
  supervision: cursorPageSchema(adminQuoteSupervisionActionSchema)
});

export const adminQuoteListResponseSchema = cursorPageSchema(adminQuoteSchema);
export const adminQuoteSupervisionListResponseSchema = cursorPageSchema(
  adminQuoteSupervisionActionSchema
);

export type AdminQuote = z.infer<typeof adminQuoteSchema>;
export type AdminQuoteDetail = z.infer<typeof adminQuoteDetailSchema>;
export type AdminQuoteSupervisionAction = z.infer<
  typeof adminQuoteSupervisionActionSchema
>;

/** `GET /api/v1/admin/quotes/[quoteId]` query (pagination only). */
export const adminQuoteDetailQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

/**
 * Body for `POST /api/v1/admin/quotes/[quoteId]/expire|void|request-revision`
 * and `POST /api/v1/admin/diagnoses/[diagnosisId]/request-revision`.
 */
export const adminQuoteCommandSchema = z
  .object({ reason: adminReasonValueSchema })
  .strict();

/**
 * Body for `POST /api/v1/admin/service-requests/[requestId]/quote-dispute/resolve`
 * (`admin-supervision.service.ts:15`).
 */
export const adminQuoteDisputeSchema = z
  .object({
    reason: adminReasonValueSchema,
    resolution: z.enum([
      "request_revision",
      "void_pending_quote",
      "uphold_latest_quote"
    ])
  })
  .strict();
