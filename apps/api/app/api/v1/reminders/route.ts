import { createDefaultReminderRouteHandlers } from "@/features/reminders/reminder.route-handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return createDefaultReminderRouteHandlers().listReminderRules(request);
}

export function POST(request: Request) {
  return createDefaultReminderRouteHandlers().createReminderRule(request);
}
