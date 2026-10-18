import { z } from "zod";

// Shared with the admin web frontend via the contract package; see
// `packages/api-contract/src/enums.ts` and its enum-parity test.
import { serviceTypes } from "@careonroad/api-contract/enums";

import { isIsoDate } from "@/lib/vietnam-date";

export { serviceTypes } from "@careonroad/api-contract/enums";
export type { ServiceType } from "@careonroad/api-contract/enums";

export const motorcycleInputSchema = z
  .object({
    brand_text: z.string().trim().min(1).max(100),
    model_text: z.string().trim().min(1).max(100),
    license_plate: z.string().trim().min(1).max(30).optional(),
    year: z.number().int().min(1950).max(2100).optional(),
    notes: z.string().trim().min(1).max(1000).optional()
  })
  .strict();

const detailText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const detailDate = z.string().refine(isIsoDate, "Date must be a real YYYY-MM-DD date.").nullable().optional();

// Partial update: omitted keeps the stored value, null clears it.
export const motorcycleDetailsPatchSchema = z
  .object({
    color: detailText(50),
    frame_number: detailText(50),
    engine_number: detailText(50),
    purchase_date: detailDate,
    purchase_price_vnd: z.number().int().min(0).max(999_999_999_999).nullable().optional(),
    insurance_provider: detailText(100),
    insurance_policy_number: detailText(100),
    insurance_expires_on: detailDate,
    warranty_expires_on: detailDate,
    preferred_service_center: detailText(200)
  })
  .strict()
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "At least one detail field is required."
  });

export const mechanicProfileUpdateSchema = z
  .object({
    service_radius_km: z.number().positive().max(100).optional(),
    service_types: z.array(z.enum(serviceTypes)).min(1).max(serviceTypes.length).optional()
  })
  .strict()
  .refine((value) => value.service_radius_km !== undefined || value.service_types !== undefined, {
    message: "At least one editable mechanic profile field is required."
  });

export const mechanicAvailabilitySchema = z
  .object({
    is_available: z.boolean()
  })
  .strict();

export const geoPointSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  })
  .strict();

export type MotorcycleInput = z.infer<typeof motorcycleInputSchema>;
export type MotorcycleDetailsPatchInput = z.infer<typeof motorcycleDetailsPatchSchema>;
export type MechanicProfileUpdateInput = z.infer<typeof mechanicProfileUpdateSchema>;
export type MechanicAvailabilityInput = z.infer<typeof mechanicAvailabilitySchema>;
export type GeoPointInput = z.infer<typeof geoPointSchema>;
