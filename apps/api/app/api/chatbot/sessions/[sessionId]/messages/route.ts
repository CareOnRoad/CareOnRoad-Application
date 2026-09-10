import { createOwnedMessageResponse } from "@/features/chatbot/api-routes";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  return createOwnedMessageResponse(request, sessionId);
}
