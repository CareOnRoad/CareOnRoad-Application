import { z } from "zod";

import { reminderItemCodes, usageLevels } from "./reminder-presets";

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

export const reminderPresetApplySchema = z
  .object({
    usage_level: z.enum(usageLevels),
    items: z
      .array(
        z
          .object({
            item_code: z.enum(reminderItemCodes),
            // Format and range are checked by the service against Vietnam "today".
            last_done_on: z.string().optional()
          })
          .strict()
      )
      .min(1)
      .max(5)
  })
  .strict()
  .refine((value) => new Set(value.items.map((item) => item.item_code)).size === value.items.length, {
    message: "item_code must not repeat.",
    path: ["items"]
  });

export const reminderDoneSchema = z.object({ done_on: z.string() }).strict();

export type ReminderRuleInput = z.infer<typeof reminderRuleInputSchema>;
export type ReminderSnoozeInput = z.infer<typeof reminderSnoozeInputSchema>;
export type ReminderPresetApplyInput = z.infer<typeof reminderPresetApplySchema>;
export type ReminderDoneInput = z.infer<typeof reminderDoneSchema>;
