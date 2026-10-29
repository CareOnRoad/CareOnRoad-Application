import { createDefaultReminderRouteHandlers } from "@/features/reminders/reminder.route-handlers";

export const runtime = "nodejs";

type ReminderDoneRouteContext = {
  params: Promise<{ reminderId: string }>;
};

export async function POST(request: Request, context: ReminderDoneRouteContext) {
  const { reminderId } = await context.params;
  return createDefaultReminderRouteHandlers().markReminderDone(request, reminderId);
}
