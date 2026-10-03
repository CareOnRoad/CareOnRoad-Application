import { createDefaultAdminReminderRouteHandlers } from "@/features/admin/admin-reminder.route-handlers";
export async function POST(request: Request, context: { params: Promise<{ reminderId: string }> }) {
  return createDefaultAdminReminderRouteHandlers().command(request, (await context.params).reminderId, "enable");
}
