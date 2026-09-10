import { createDefaultDiagnosisQuoteRouteHandlers } from "@/features/quotes/diagnosis-quote.route-handlers";

export const runtime = "nodejs";

type QuoteRouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function GET(request: Request, context: QuoteRouteContext) {
  const { requestId } = await context.params;
  return createDefaultDiagnosisQuoteRouteHandlers().listQuotes(request, requestId);
}

export async function POST(request: Request, context: QuoteRouteContext) {
  const { requestId } = await context.params;
  return createDefaultDiagnosisQuoteRouteHandlers().createQuote(request, requestId);
}
