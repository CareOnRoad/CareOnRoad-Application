import { getOwnedLatestDiagnosisResponse } from "@/features/chatbot/api-routes";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  return getOwnedLatestDiagnosisResponse(request, sessionId);
}
