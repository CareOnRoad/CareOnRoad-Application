import { createDefaultAdminReminderRouteHandlers } from "@/features/admin/admin-reminder.route-handlers";
export async function GET(request: Request) {
  return createDefaultAdminReminderRouteHandlers().read(request, "health");
}
