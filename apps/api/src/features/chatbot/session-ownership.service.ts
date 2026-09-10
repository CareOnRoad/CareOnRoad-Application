import { createHash, randomBytes } from "node:crypto";
import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { authenticateSupabaseRequest } from "@/server/auth/request-actor";
import type { ChatbotSessionRepository } from "@/server/repositories/contracts/chatbot-session.repository";
import { getChatbotSessionRepository } from "@/server/repositories/chatbot-session-repository.factory";

export const chatbotOwnerCookie = "careonroad_chat_owner";

export class SessionOwnershipService {
  constructor(private readonly repository: ChatbotSessionRepository, private readonly options: {
    authenticate?: (request: Request) => Promise<VerifiedSupabaseIdentity>;
    createToken?: () => string;
    now?: () => Date;
  } = {}) {}

  async createSession() {
    const token = this.options.createToken?.() ?? randomBytes(32).toString("base64url");
    const session = await this.repository.createSession(this.options.now?.() ?? new Date(), { ownerCredentialHash: hashCredential(token) });
    return { session, token };
  }

  async authorize(request: Request, sessionId: string) {
    const token = readCredential(request); const ownerUserId = await this.optionalUserId(request);
    return this.repository.getAuthorizedSession(sessionId, { ...(token ? { credentialHash: hashCredential(token) } : {}), ...(ownerUserId ? { ownerUserId } : {}) });
  }

  async claim(request: Request, sessionId: string) {
    const token = readCredential(request); if (!token) return null;
    const identity = await (this.options.authenticate ?? authenticateSupabaseRequest)(request);
    return this.repository.claimSessionOwner(sessionId, hashCredential(token), identity.subject, this.options.now?.() ?? new Date());
  }

  private async optionalUserId(request: Request) {
    if (!request.headers.get("authorization")?.toLowerCase().startsWith("bearer ")) return undefined;
    try { return (await (this.options.authenticate ?? authenticateSupabaseRequest)(request)).subject; } catch { return undefined; }
  }
}

export function getSessionOwnershipService() { return new SessionOwnershipService(getChatbotSessionRepository()); }
export function hashCredential(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function ownerCookie(token: string, sessionId: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${chatbotOwnerCookie}=${encodeURIComponent(token)}; Path=/api/chatbot/sessions/${sessionId}; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}
function readCredential(request: Request) {
  const header = request.headers.get("x-chatbot-session-token")?.trim(); if (header) return header;
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) { const [name, ...rest] = part.trim().split("="); if (name === chatbotOwnerCookie) return decodeURIComponent(rest.join("=")); }
  return undefined;
}
