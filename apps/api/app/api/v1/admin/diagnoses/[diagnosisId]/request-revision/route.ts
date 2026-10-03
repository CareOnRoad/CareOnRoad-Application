import { createDefaultAdminSupervisionRouteHandlers } from "@/features/admin/admin-supervision.route-handlers";

export async function POST(request: Request, context: { params: Promise<{ diagnosisId: string }> }) {
  return createDefaultAdminSupervisionRouteHandlers().command(request, (await context.params).diagnosisId, "diagnosis_revision");
}
