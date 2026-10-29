import { createDefaultReminderRouteHandlers } from "@/features/reminders/reminder.route-handlers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return createDefaultReminderRouteHandlers().listReminderPresets(request);
}
