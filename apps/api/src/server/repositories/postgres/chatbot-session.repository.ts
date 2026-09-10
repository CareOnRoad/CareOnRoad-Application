import type { TransactionSql } from "postgres";

import { diagnosisSchema, type DiagnosisResult } from "@/features/chatbot/diagnosis.schema";

import type {
  AppendChatbotMessage,
  ChatbotDiagnosisCreateOptions,
  ChatbotMessage,
  ChatbotMessageCreateOptions,
  ChatbotSession,
  ChatbotSessionCreateOptions,
  ChatbotSessionRepository
} from "../contracts/chatbot-session.repository";
import type { JsonObject } from "../contracts/idempotency.repository";

type SessionRow = {
  id: string;
  owner_user_id: string | null;
  owner_credential_hash: string | null;
  owner_claimed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type MessageRow = {
  id: string;
  session_id: string;
  input_mode: "text" | "voice";
  content_text: string | null;
  transcribed_text: string | null;
  normalized_text: string;
  safety_answers: Record<string, unknown> | null;
  created_at: Date;
};

type DiagnosisRow = {
  result: JsonObject;
};

export class PostgresChatbotSessionRepository implements ChatbotSessionRepository {
  constructor(private readonly sql: TransactionSql) {}

  async createSession(
    now = new Date(),
    options: ChatbotSessionCreateOptions = {}
  ): Promise<ChatbotSession> {
    const id = options.sessionId ?? crypto.randomUUID();
    const rows = await this.sql<SessionRow[]>`
      insert into chatbot_sessions (id, owner_user_id, owner_credential_hash, created_at, updated_at)
      values (${id}, ${options.ownerUserId ?? null}, ${options.ownerCredentialHash ?? null}, ${now}, ${now})
      returning *
    `;
    return mapSession(rows[0]!, [], null);
  }

  async getAuthorizedSession(sessionId: string, access: { credentialHash?: string; ownerUserId?: string }): Promise<ChatbotSession | null> {
    const rows = await this.sql<SessionRow[]>`
      select * from chatbot_sessions where id = ${sessionId}
        and owner_credential_hash is not null
        and ((owner_user_id is null and owner_credential_hash = ${access.credentialHash ?? null}) or owner_user_id = ${access.ownerUserId ?? null})
      limit 1
    `;
    return rows[0] ? mapSession(rows[0], [], await this.getLatestDiagnosis(sessionId)) : null;
  }

  async claimSessionOwner(sessionId: string, credentialHash: string, ownerUserId: string, now = new Date()) {
    const current = await this.sql<SessionRow[]>`select session.* from chatbot_sessions session join app_users user_account on user_account.id = ${ownerUserId} and user_account.status = 'active' where session.id = ${sessionId} and session.owner_credential_hash = ${credentialHash} for update`;
    if (!current[0] || (current[0].owner_user_id && current[0].owner_user_id !== ownerUserId)) return null;
    if (current[0].owner_user_id === ownerUserId) return { session: mapSession(current[0], [], null), claimed: false };
    const rows = await this.sql<SessionRow[]>`update chatbot_sessions set owner_user_id = ${ownerUserId}, owner_claimed_at = ${now}, updated_at = ${now} where id = ${sessionId} returning *`;
    return { session: mapSession(rows[0], [], null), claimed: true };
  }

  async getSession(sessionId: string): Promise<ChatbotSession | null> {
    const sessions = await this.sql<SessionRow[]>`
      select * from chatbot_sessions where id = ${sessionId} limit 1
    `;
    if (!sessions[0]) {
      return null;
    }
    const messages = await this.sql<MessageRow[]>`
      select *
      from chatbot_messages
      where session_id = ${sessionId}
      order by created_at, id
    `;
    return mapSession(
      sessions[0],
      messages.map(mapMessage),
      await this.getLatestDiagnosis(sessionId)
    );
  }

  async appendMessage(
    sessionId: string,
    message: AppendChatbotMessage,
    now = new Date(),
    options: ChatbotMessageCreateOptions = {}
  ): Promise<ChatbotMessage | null> {
    const rows = await this.sql<MessageRow[]>`
      insert into chatbot_messages (
        id, session_id, input_mode, content_text, transcribed_text,
        normalized_text, safety_answers, created_at
      )
      select
        ${options.messageId ?? crypto.randomUUID()}, session.id, ${message.input_mode},
        ${message.content_text}, ${message.transcribed_text}, ${message.normalized_text},
        ${message.safety_answers
          ? this.sql.json(
              message.safety_answers as Parameters<TransactionSql["json"]>[0]
            )
          : null},
        ${now}
      from chatbot_sessions session
      where session.id = ${sessionId}
      returning *
    `;
    if (!rows[0]) {
      return null;
    }
    await this.sql`
      update chatbot_sessions set updated_at = ${now} where id = ${sessionId}
    `;
    return mapMessage(rows[0]);
  }

  async setLatestDiagnosis(
    sessionId: string,
    diagnosis: DiagnosisResult,
    now = new Date(),
    options: ChatbotDiagnosisCreateOptions = {}
  ): Promise<DiagnosisResult | null> {
    const rows = await this.sql<DiagnosisRow[]>`
      insert into diagnosis_results (
        id, session_id, message_id, result, risk_level, fallback_used,
        provider_name, provider_model, created_at
      )
      select
        ${options.diagnosisId ?? crypto.randomUUID()}, session.id,
        ${options.messageId ?? null},
        ${this.sql.json(diagnosis as Parameters<TransactionSql["json"]>[0])},
        ${diagnosis.risk_level}, ${diagnosis.fallback_used},
        ${options.providerName ?? null}, ${options.providerModel ?? null}, ${now}
      from chatbot_sessions session
      where session.id = ${sessionId}
      returning result
    `;
    if (!rows[0]) {
      return null;
    }
    await this.sql`
      update chatbot_sessions set updated_at = ${now} where id = ${sessionId}
    `;
    return diagnosisSchema.parse(rows[0].result);
  }

  async getLatestDiagnosis(sessionId: string): Promise<DiagnosisResult | null> {
    const rows = await this.sql<DiagnosisRow[]>`
      select result
      from diagnosis_results
      where session_id = ${sessionId}
      order by created_at desc, id desc
      limit 1
    `;
    return rows[0] ? diagnosisSchema.parse(rows[0].result) : null;
  }
}

function mapSession(
  row: SessionRow,
  messages: ChatbotMessage[],
  latestDiagnosis: DiagnosisResult | null
): ChatbotSession {
  return {
    session_id: row.id,
    ...(row.owner_user_id ? { owner_user_id: row.owner_user_id } : {}),
    ...(row.owner_credential_hash ? { owner_credential_hash: row.owner_credential_hash } : {}),
    ...(row.owner_claimed_at ? { owner_claimed_at: row.owner_claimed_at.toISOString() } : {}),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    messages,
    latest_diagnosis: latestDiagnosis
  };
}

function mapMessage(row: MessageRow): ChatbotMessage {
  return {
    message_id: row.id,
    session_id: row.session_id,
    input_mode: row.input_mode,
    content_text: row.content_text,
    transcribed_text: row.transcribed_text,
    normalized_text: row.normalized_text,
    safety_answers: row.safety_answers,
    created_at: row.created_at.toISOString()
  };
}
