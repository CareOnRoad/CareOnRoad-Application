import { z } from "zod";

export const reminderRuleInputSchema = z
  .object({
    motorcycle_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    interval_days: z.number().int().min(1).max(3650).optional(),
    next_due_at: z.string().datetime({ offset: true }),
    enabled: z.boolean()
  })
  .strict();

export const reminderSnoozeInputSchema = z
  .object({
    until: z.string().datetime({ offset: true })
  })
  .strict();

export type ReminderRuleInput = z.infer<typeof reminderRuleInputSchema>;
export type ReminderSnoozeInput = z.infer<typeof reminderSnoozeInputSchema>;
