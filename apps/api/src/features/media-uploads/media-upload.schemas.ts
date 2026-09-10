import { z } from "zod";

export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_MAX_FILES_PER_RESOURCE = 5;
export const MEDIA_INTENT_TTL_MS = 10 * 60 * 1000;

export const mediaContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const requestMediaPurposes = ["problem_photo", "other"] as const;
export const assignmentMediaPurposes = ["diagnosis", "work_proof", "safety", "other"] as const;

export const createMediaUploadIntentSchema = z
  .object({
    resource_type: z.enum(["service_request", "assignment"]),
    resource_id: z.string().uuid(),
    purpose: z.enum(["problem_photo", "diagnosis", "work_proof", "safety", "other"]),
    content_type: z.enum(mediaContentTypes),
    size_bytes: z.number().int().min(1).max(MEDIA_MAX_BYTES),
    sha256: z.string().regex(/^[0-9a-f]{64}$/)
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.resource_type === "service_request" &&
      !requestMediaPurposes.includes(input.purpose as (typeof requestMediaPurposes)[number])
    ) {
      context.addIssue({ code: "custom", path: ["purpose"], message: "Invalid request media purpose." });
    }
    if (
      input.resource_type === "assignment" &&
      !assignmentMediaPurposes.includes(input.purpose as (typeof assignmentMediaPurposes)[number])
    ) {
      context.addIssue({ code: "custom", path: ["purpose"], message: "Invalid assignment media purpose." });
    }
  });

export const mediaUploadIntentIdSchema = z.string().uuid();

export type CreateMediaUploadIntentInput = z.infer<typeof createMediaUploadIntentSchema>;

export function extensionForContentType(contentType: (typeof mediaContentTypes)[number]): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

export function createMediaObjectKey(input: {
  resourceType: "service_request" | "assignment";
  resourceId: string;
  actorId: string;
  intentId: string;
  contentType: (typeof mediaContentTypes)[number];
}): string {
  const prefix = input.resourceType === "service_request" ? "service-requests" : "assignments";
  return `${prefix}/${input.resourceId}/${input.actorId}/${input.intentId}.${extensionForContentType(input.contentType)}`;
}
