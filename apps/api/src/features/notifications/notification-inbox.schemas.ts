import { z } from "zod";

export const notificationInboxQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().trim().min(1).max(500).optional(),
    unread_only: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default("false")
  })
  .strict();

export const notificationIdSchema = z.string().uuid();
