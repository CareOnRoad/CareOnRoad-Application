import { createDefaultReminderRouteHandlers } from "@/features/reminders/reminder.route-handlers";

export const runtime = "nodejs";

type ReminderPresetsRouteContext = {
  params: Promise<{ motorcycleId: string }>;
};

export async function POST(request: Request, context: ReminderPresetsRouteContext) {
  const { motorcycleId } = await context.params;
  return createDefaultReminderRouteHandlers().applyReminderPresets(request, motorcycleId);
}
