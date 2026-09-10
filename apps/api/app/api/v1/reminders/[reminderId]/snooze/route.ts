import { createDefaultReminderRouteHandlers } from "@/features/reminders/reminder.route-handlers";

export const runtime = "nodejs";

type ReminderSnoozeRouteContext = {
  params: Promise<{ reminderId: string }>;
};

export async function POST(request: Request, context: ReminderSnoozeRouteContext) {
  const { reminderId } = await context.params;
  return createDefaultReminderRouteHandlers().snoozeReminderRule(request, reminderId);
}
