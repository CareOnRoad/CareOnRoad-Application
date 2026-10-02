import { createDefaultAdminReminderRouteHandlers } from "@/features/admin/admin-reminder.route-handlers";
export async function POST(request: Request, context: { params: Promise<{ occurrenceId: string }> }) {
  return createDefaultAdminReminderRouteHandlers().command(request, (await context.params).occurrenceId, "retry");
}
