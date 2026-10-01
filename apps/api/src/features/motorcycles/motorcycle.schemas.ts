import { z } from "zod";

// Shared with the admin web frontend via the contract package; see
// `packages/api-contract/src/enums.ts` and its enum-parity test.
import { serviceTypes } from "@careonroad/api-contract/enums";

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
export type MechanicProfileUpdateInput = z.infer<typeof mechanicProfileUpdateSchema>;
export type MechanicAvailabilityInput = z.infer<typeof mechanicAvailabilitySchema>;
export type GeoPointInput = z.infer<typeof geoPointSchema>;
