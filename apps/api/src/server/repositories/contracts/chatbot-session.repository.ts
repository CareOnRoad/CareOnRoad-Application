import type { DiagnosisResult } from "@/features/chatbot/diagnosis.schema";

export type MaybePromise<T> = T | Promise<T>;
export type ChatbotInputMode = "text" | "voice";

export type ChatbotMessage = {
  message_id: string;
  session_id: string;
  input_mode: ChatbotInputMode;
  content_text: string | null;
  transcribed_text: string | null;
  normalized_text: string;
  safety_answers: Record<string, unknown> | null;
  created_at: string;
};

export type ChatbotSession = {
  session_id: string;
  owner_user_id?: string;
  owner_credential_hash?: string;
  owner_claimed_at?: string;
  created_at: string;
  updated_at: string;
  messages: ChatbotMessage[];
  latest_diagnosis: DiagnosisResult | null;
};

export type AppendChatbotMessage = Omit<
  ChatbotMessage,
  "message_id" | "session_id" | "created_at"
>;

export type ChatbotSessionCreateOptions = {
  sessionId?: string;
  ownerUserId?: string;
  ownerCredentialHash?: string;
};

export type ChatbotSessionAccess = { credentialHash?: string; ownerUserId?: string };
export type ChatbotSessionClaimResult = { session: ChatbotSession; claimed: boolean };

export type ChatbotMessageCreateOptions = {
  messageId?: string;
};

export type ChatbotDiagnosisCreateOptions = {
  diagnosisId?: string;
  messageId?: string;
  providerName?: string;
  providerModel?: string;
};

export interface ChatbotSessionRepository {
  createSession(
    now?: Date,
    options?: ChatbotSessionCreateOptions
  ): MaybePromise<ChatbotSession>;
  getSession(sessionId: string): MaybePromise<ChatbotSession | null>;
  getAuthorizedSession(sessionId: string, access: ChatbotSessionAccess): MaybePromise<ChatbotSession | null>;
  claimSessionOwner(sessionId: string, credentialHash: string, ownerUserId: string, now?: Date): MaybePromise<ChatbotSessionClaimResult | null>;
  appendMessage(
    sessionId: string,
    message: AppendChatbotMessage,
    now?: Date,
    options?: ChatbotMessageCreateOptions
  ): MaybePromise<ChatbotMessage | null>;
  setLatestDiagnosis(
    sessionId: string,
    diagnosis: DiagnosisResult,
    now?: Date,
    options?: ChatbotDiagnosisCreateOptions
  ): MaybePromise<DiagnosisResult | null>;
  getLatestDiagnosis(sessionId: string): MaybePromise<DiagnosisResult | null>;
}
