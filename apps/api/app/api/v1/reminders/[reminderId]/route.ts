import { createDefaultReminderRouteHandlers } from "@/features/reminders/reminder.route-handlers";

export const runtime = "nodejs";

type ReminderRouteContext = {
  params: Promise<{ reminderId: string }>;
};

export async function PATCH(request: Request, context: ReminderRouteContext) {
  const { reminderId } = await context.params;
  return createDefaultReminderRouteHandlers().updateReminderRule(request, reminderId);
}

export async function DELETE(request: Request, context: ReminderRouteContext) {
  const { reminderId } = await context.params;
  return createDefaultReminderRouteHandlers().disableReminderRule(request, reminderId);
}
