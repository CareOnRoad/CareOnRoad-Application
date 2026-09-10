import { createDefaultDiagnosisQuoteRouteHandlers } from "@/features/quotes/diagnosis-quote.route-handlers";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ quoteId: string }> }
) {
  const { quoteId } = await context.params;
  return createDefaultDiagnosisQuoteRouteHandlers().rejectQuote(request, quoteId);
}
