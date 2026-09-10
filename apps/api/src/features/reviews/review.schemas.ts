import { z } from "zod";

export const assignmentReviewIdSchema = z.string().uuid();

export const createReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(1000).optional()
  })
  .strict();

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
