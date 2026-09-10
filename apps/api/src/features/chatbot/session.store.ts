import type { DiagnosisResult } from "./diagnosis.schema";
import type {
  AppendChatbotMessage,
  ChatbotMessage,
  ChatbotMessageCreateOptions,
  ChatbotSession,
  ChatbotSessionCreateOptions,
  ChatbotSessionRepository
} from "@/server/repositories/contracts/chatbot-session.repository";
import { timingSafeEqual } from "node:crypto";

export type InputMode = "text" | "voice";
export type RiderMessage = ChatbotMessage;
export type { ChatbotSession };

export class InMemorySessionStore implements ChatbotSessionRepository {
  constructor(private readonly sessions: ChatbotSession[] = []) {}

  createSession(
    now = new Date(),
    options: ChatbotSessionCreateOptions = {}
  ): ChatbotSession {
    const timestamp = now.toISOString();
    const session: ChatbotSession = {
      session_id: options.sessionId ?? crypto.randomUUID(),
      ...(options.ownerUserId ? { owner_user_id: options.ownerUserId } : {}),
      ...(options.ownerCredentialHash ? { owner_credential_hash: options.ownerCredentialHash } : {}),
      created_at: timestamp,
      updated_at: timestamp,
      messages: [],
      latest_diagnosis: null
    };

    this.sessions.push(session);
    return session;
  }

  getSession(sessionId: string): ChatbotSession | null {
    return this.sessions.find((session) => session.session_id === sessionId) ?? null;
  }

  getAuthorizedSession(sessionId: string, access: { credentialHash?: string; ownerUserId?: string }): ChatbotSession | null {
    const session = this.getSession(sessionId); if (!session?.owner_credential_hash) return null;
    const credentialMatches = !session.owner_user_id && access.credentialHash ? safeHashEqual(session.owner_credential_hash, access.credentialHash) : false;
    const userMatches = Boolean(access.ownerUserId && session.owner_user_id === access.ownerUserId);
    return credentialMatches || userMatches ? session : null;
  }

  claimSessionOwner(sessionId: string, credentialHash: string, ownerUserId: string, now = new Date()) {
    const session = this.getSession(sessionId);
    if (!session?.owner_credential_hash || !safeHashEqual(session.owner_credential_hash, credentialHash)) return null;
    if (session.owner_user_id && session.owner_user_id !== ownerUserId) return null;
    const claimed = !session.owner_user_id; session.owner_user_id = ownerUserId;
    session.owner_claimed_at ??= now.toISOString(); session.updated_at = now.toISOString();
    return { session, claimed };
  }

  appendMessage(
    sessionId: string,
    message: AppendChatbotMessage,
    now = new Date(),
    options: ChatbotMessageCreateOptions = {}
  ): RiderMessage | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const timestamp = now.toISOString();
    const storedMessage: RiderMessage = {
      ...message,
      message_id: options.messageId ?? crypto.randomUUID(),
      session_id: sessionId,
      created_at: timestamp
    };

    session.messages.push(storedMessage);
    session.updated_at = timestamp;
    return storedMessage;
  }

  setLatestDiagnosis(sessionId: string, diagnosis: DiagnosisResult, now = new Date()): DiagnosisResult | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.latest_diagnosis = diagnosis;
    session.updated_at = now.toISOString();
    return diagnosis;
  }

  getLatestDiagnosis(sessionId: string): DiagnosisResult | null {
    return this.getSession(sessionId)?.latest_diagnosis ?? null;
  }

  clear() {
    this.sessions.splice(0, this.sessions.length);
  }
}

function safeHashEqual(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }

const sessionStoreGlobalKey = "__careonroad_session_store__";
const globalSessionStore = globalThis as typeof globalThis & {
  [sessionStoreGlobalKey]?: InMemorySessionStore;
};

export const sessionStore = (globalSessionStore[sessionStoreGlobalKey] ??= new InMemorySessionStore());
