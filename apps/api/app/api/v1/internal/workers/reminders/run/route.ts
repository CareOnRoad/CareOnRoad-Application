import { createDefaultReminderRouteHandlers } from "@/features/reminders/reminder.route-handlers";

export const runtime = "nodejs";

export function POST(request: Request) {
  return createDefaultReminderRouteHandlers().runReminderWorker(request);
}
