import { z } from "zod";

import { geoPointSchema, serviceTypes } from "@/features/motorcycles/motorcycle.schemas";

export const fulfillmentModes = ["immediate_location", "scheduled_visit"] as const;
export type FulfillmentModeInput = (typeof fulfillmentModes)[number];

const requestMediaMetadataInputSchema = z
  .object({
    media_type: z.string().trim().min(1).max(50),
    object_reference: z.string().trim().min(1).max(1000),
    content_type: z.string().trim().min(1).max(200),
    size_bytes: z.number().int().min(0).optional(),
    checksum: z.string().trim().min(1).max(200).optional()
  })
  .strict();

export const serviceRequestInputSchema = z
  .object({
    motorcycle_id: z.string().uuid(),
    service_type: z.enum(serviceTypes),
    fulfillment_mode: z.enum(fulfillmentModes).optional(),
    problem_description: z.string().trim().min(3).max(3000),
    location: geoPointSchema.optional(),
    address_text: z.string().trim().min(1).max(500).optional(),
    scheduled_start_at: z.string().datetime({ offset: true }).optional(),
    reminder_id: z.string().uuid().optional(),
    reminder_context_id: z.string().uuid().optional(),
    safety_answers: z.record(z.string(), z.unknown()).optional(),
    maintenance_notes: z.string().trim().min(1).max(2000).optional(),
    media_metadata: z.array(requestMediaMetadataInputSchema).max(10).optional()
  })
  .strict();

export const cancelServiceRequestInputSchema = z
  .object({
    reason: z.string().trim().min(1).max(500)
  })
  .strict();

export const appointmentUpdateSchema = z.object({
  location: geoPointSchema.optional(),
  address_text: z.string().trim().min(1).max(500).optional(),
  scheduled_start_at: z.string().datetime({ offset: true }).nullable().optional()
}).strict().refine((input) => Object.keys(input).length > 0, "At least one appointment field is required.");

export { requestMediaMetadataInputSchema };

export type ServiceRequestInput = z.infer<typeof serviceRequestInputSchema>;
export type RequestMediaMetadataInput = z.infer<typeof requestMediaMetadataInputSchema>;
export type CancelServiceRequestInput = z.infer<typeof cancelServiceRequestInputSchema>;
