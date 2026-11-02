import { z } from "zod";

import { adminReasonValueSchema } from "./common";

/**
 * Response schemas for `/api/v1/admin/configuration/**`.
 *
 * Shapes mirror `AdminConfigurationService` in
 * `apps/api/src/features/admin/admin-configuration.service.ts` and the
 * dispatch policy schema in `admin-configuration.schemas.ts`.
 *
 * IMPORTANT — `PUT /api/v1/admin/configuration/dispatch` changes the live
 * dispatch policy. The backend applies it to NEW dispatch episodes only
 * (`applies_to: "new_dispatch_episodes"`), so the frontend must show the
 * current values and the proposed change before submitting.
 *
 * The configuration history table is append-only in PostgreSQL (trigger
 * `admin_operation_config_versions_append_only` in migration
 * `202606250045`) — never offer a delete action for it.
 */

export const adminDispatchPolicyShapeSchema = z.object({
  "dispatch.radius_steps_km": z.array(z.number().min(1).max(100)).min(1).max(8),
  "dispatch.offer_expiry_seconds": z.number().int().min(30).max(300),
  "dispatch.max_rounds": z.number().int().min(1).max(8),
  "dispatch.total_wait_seconds": z.number().int().min(60).max(1800)
});

export type AdminDispatchPolicyShape = z.infer<
  typeof adminDispatchPolicyShapeSchema
>;

/** `GET /api/v1/admin/configuration` (service lines 22-29). */
export const adminConfigurationSchema = z.object({
  enabled: z.boolean(),
  values: adminDispatchPolicyShapeSchema,
  versions: z.record(z.string(), z.number().int().positive()),
  history: z.array(
    z.object({
      key: z.string(),
      version: z.number().int().positive(),
      previous_value: z.unknown().optional(),
      value: z.unknown(),
      updated_by: z.string(),
      updated_at: z.string()
    })
  ),
  history_limit: z.number().int().positive(),
  applies_to: z.literal("new_dispatch_episodes")
});

/**
 * `GET /api/v1/admin/configuration/provider-budgets` (service lines 20-21)
 * is read-only and exposes only whether a provider is configured. The usage
 * and limit fields are always `null` because the runtime does not expose
 * provider budgets.
 */
export const adminProviderBudgetSchema = z.object({
  provider: z.string(),
  configured: z.boolean(),
  usage: z.number().nullish(),
  limit: z.number().nullish(),
  remaining: z.number().nullish(),
  budget_source: z.string()
});

export const adminProviderBudgetsSchema = z.object({
  source: z.string(),
  read_only: z.literal(true),
  providers: z.array(adminProviderBudgetSchema)
});

export type AdminConfiguration = z.infer<typeof adminConfigurationSchema>;
export type AdminProviderBudget = z.infer<typeof adminProviderBudgetSchema>;

/**
 * Body for `PUT /api/v1/admin/configuration/dispatch`.
 *
 * Only the changed keys may be sent, but the resulting policy must still be
 * valid: the radius steps must stay strictly ascending and
 * `total_wait_seconds` must cover at least one offer window.
 */
export const adminDispatchConfigurationUpdateSchema = z
  .object({
    reason: adminReasonValueSchema,
    values: adminDispatchPolicyShapeSchema
      .partial()
      .refine((values) => Object.keys(values).length > 0, {
        message: "At least one value is required."
      })
  })
  .strict();

/**
 * Client-side guard mirroring the backend refine
 * (`admin-configuration.schemas.ts`): the total wait must cover one offer
 * window.
 */
export function isDispatchPolicyUpdateValid(
  current: AdminDispatchPolicyShape,
  update: Partial<AdminDispatchPolicyShape>
): boolean {
  const merged = { ...current, ...update };
  if (
    merged["dispatch.total_wait_seconds"] <
    merged["dispatch.offer_expiry_seconds"]
  ) {
    return false;
  }
  const steps = merged["dispatch.radius_steps_km"];
  for (let index = 1; index < steps.length; index += 1) {
    if (steps[index] <= steps[index - 1]) {
      return false;
    }
  }
  return true;
}
