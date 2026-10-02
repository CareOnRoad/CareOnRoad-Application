import { createDefaultAdminReminderRouteHandlers } from "@/features/admin/admin-reminder.route-handlers";
export async function GET(request: Request, context: { params: Promise<{ reminderId: string }> }) {
  return createDefaultAdminReminderRouteHandlers().read(request, "detail", (await context.params).reminderId);
}
