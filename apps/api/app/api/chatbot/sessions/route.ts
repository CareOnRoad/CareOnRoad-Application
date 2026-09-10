import { createOwnedSessionResponse } from "@/features/chatbot/api-routes";

export async function POST() {
  return createOwnedSessionResponse();
}
