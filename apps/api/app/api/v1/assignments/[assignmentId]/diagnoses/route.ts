import { createDefaultDiagnosisQuoteRouteHandlers } from "@/features/quotes/diagnosis-quote.route-handlers";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params;
  return createDefaultDiagnosisQuoteRouteHandlers().upsertDiagnosis(request, assignmentId);
}
