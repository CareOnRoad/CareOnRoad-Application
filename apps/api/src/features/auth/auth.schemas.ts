import { z } from "zod";

import { userRoles, userStatuses } from "./auth.types";
import { pushProviders } from "@/server/repositories/contracts/device-delivery-credential.repository";

export const verifiedIdentitySchema = z.object({
  subject: z.string().uuid(),
  issuer: z.string().url(),
  audience: z.array(z.string().min(1)).min(1),
  displayName: z.string().trim().min(1).max(120).optional()
});

export const bootstrapProfileSchema = z
  .object({
    display_name: z.string().trim().min(1).max(120).optional(),
    account_type: z.enum(["rider", "mechanic"]).optional()
  })
  .strict();

export const registerDeviceSchema = z
  .object({
    device_key: z.string().trim().min(8).max(1000),
    platform: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9._-]+$/i)
      .transform((value) => value.toLowerCase()),
    push_provider: z.enum(pushProviders).optional(),
    push_token: z.string().trim().min(8).max(4096).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.push_provider) !== Boolean(value.push_token)) {
      context.addIssue({
        code: "custom",
        message: "Push provider and token must be supplied together.",
        path: [value.push_provider ? "push_token" : "push_provider"]
      });
    }
  });

export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(120)
}).strict();

export const rotatePushTokenSchema = z
  .object({
    push_provider: z.enum(pushProviders),
    push_token: z.string().trim().min(8).max(4096)
  })
  .strict();

export const requestActorSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().min(1).max(120).optional(),
  roles: z.array(z.enum(userRoles)),
  status: z.enum(userStatuses)
});

export type BootstrapProfileInput = z.infer<typeof bootstrapProfileSchema>;
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type RotatePushTokenInput = z.infer<typeof rotatePushTokenSchema>;
