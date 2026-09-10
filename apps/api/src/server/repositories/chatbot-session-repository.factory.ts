import { randomUUID } from "node:crypto";

import type { Sql } from "postgres";

import type { DiagnosisResult } from "@/features/chatbot/diagnosis.schema";
import { sessionStore } from "@/features/chatbot/session.store";
import { getPostgresClient } from "@/server/db/postgres-client";

import type {
  AppendChatbotMessage,
  ChatbotDiagnosisCreateOptions,
  ChatbotMessage,
  ChatbotMessageCreateOptions,
  ChatbotSession,
  ChatbotSessionCreateOptions,
  ChatbotSessionRepository
} from "./contracts/chatbot-session.repository";
import type { FoundationRepositories, UnitOfWork } from "./contracts/unit-of-work";
import { PostgresUnitOfWork } from "./postgres/postgres-unit-of-work";

export type ChatbotPersistenceMode = "memory" | "postgres";
export type ChatbotPersistenceEnvironment = {
  CHATBOT_PERSISTENCE_MODE?: string;
};

export class AuditedChatbotSessionRepository implements ChatbotSessionRepository {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly options: {
      now?: () => Date;
      createId?: () => string;
    } = {}
  ) {}

  createSession(
    now = this.options.now?.() ?? new Date(),
    options: ChatbotSessionCreateOptions = {}
  ): Promise<ChatbotSession> {
    const createId = this.options.createId ?? randomUUID;
    const sessionId = options.sessionId ?? createId();
    return this.unitOfWork.execute(async (repositories) => {
      const session = await repositories.chatbotSessions.createSession(now, {
        ...options,
        sessionId
      });
      await appendPersistenceEvent(repositories, {
        id: sessionId,
        entityType: "chatbot_session",
        topic: "chatbot.session.created",
        status: "created",
        now,
        createId
      });
      return session;
    });
  }

  getSession(sessionId: string): Promise<ChatbotSession | null> {
    return this.unitOfWork.execute(({ chatbotSessions }) =>
      Promise.resolve(chatbotSessions.getSession(sessionId))
    );
  }

  getAuthorizedSession(sessionId: string, access: Parameters<ChatbotSessionRepository["getAuthorizedSession"]>[1]): Promise<ChatbotSession | null> {
    return this.unitOfWork.execute(({ chatbotSessions }) => Promise.resolve(chatbotSessions.getAuthorizedSession(sessionId, access)));
  }

  claimSessionOwner(sessionId: string, credentialHash: string, ownerUserId: string, now = this.options.now?.() ?? new Date()) {
    const createId = this.options.createId ?? randomUUID;
    return this.unitOfWork.execute(async (repositories) => {
      const result = await repositories.chatbotSessions.claimSessionOwner(sessionId, credentialHash, ownerUserId, now);
      if (result?.claimed) await appendPersistenceEvent(repositories, { id: sessionId, entityType: "chatbot_session", topic: "chatbot.session.claimed", status: "stored", sessionId, eventType: "authenticated_owner", now, createId });
      return result;
    });
  }

  appendMessage(
    sessionId: string,
    message: AppendChatbotMessage,
    now = this.options.now?.() ?? new Date(),
    options: ChatbotMessageCreateOptions = {}
  ): Promise<ChatbotMessage | null> {
    const createId = this.options.createId ?? randomUUID;
    const messageId = options.messageId ?? createId();
    return this.unitOfWork.execute(async (repositories) => {
      const stored = await repositories.chatbotSessions.appendMessage(
        sessionId,
        message,
        now,
        { messageId }
      );
      if (!stored) {
        return null;
      }
      await appendPersistenceEvent(repositories, {
        id: stored.message_id,
        entityType: "chatbot_message",
        topic: "chatbot.message.persisted",
        status: "stored",
        sessionId,
        eventType: stored.input_mode,
        now,
        createId
      });
      return stored;
    });
  }

  setLatestDiagnosis(
    sessionId: string,
    diagnosis: DiagnosisResult,
    now = this.options.now?.() ?? new Date(),
    options: ChatbotDiagnosisCreateOptions = {}
  ): Promise<DiagnosisResult | null> {
    const createId = this.options.createId ?? randomUUID;
    const diagnosisId = options.diagnosisId ?? createId();
    return this.unitOfWork.execute(async (repositories) => {
      const stored = await repositories.chatbotSessions.setLatestDiagnosis(
        sessionId,
        diagnosis,
        now,
        { ...options, diagnosisId }
      );
      if (!stored) {
        return null;
      }
      await appendPersistenceEvent(repositories, {
        id: diagnosisId,
        entityType: "diagnosis_result",
        topic: "chatbot.diagnosis.persisted",
        status: "stored",
        sessionId,
        eventType: diagnosis.fallback_used ? "fallback" : "model",
        now,
        createId
      });
      return stored;
    });
  }

  getLatestDiagnosis(
    sessionId: string
  ): Promise<Awaited<ReturnType<ChatbotSessionRepository["getLatestDiagnosis"]>>> {
    return this.unitOfWork.execute(({ chatbotSessions }) =>
      Promise.resolve(chatbotSessions.getLatestDiagnosis(sessionId))
    );
  }
}

export function readChatbotPersistenceMode(
  environment: ChatbotPersistenceEnvironment = {
    CHATBOT_PERSISTENCE_MODE: process.env.CHATBOT_PERSISTENCE_MODE
  }
): ChatbotPersistenceMode {
  const mode = environment.CHATBOT_PERSISTENCE_MODE?.trim().toLowerCase() || "memory";
  if (mode !== "memory" && mode !== "postgres") {
    throw new Error("CHATBOT_PERSISTENCE_MODE must be either memory or postgres.");
  }
  return mode;
}

export function createChatbotSessionRepository(options: {
  environment?: ChatbotPersistenceEnvironment;
  memoryRepository?: ChatbotSessionRepository;
  unitOfWork?: UnitOfWork;
  sql?: Sql;
  now?: () => Date;
  createId?: () => string;
} = {}): ChatbotSessionRepository {
  const mode = readChatbotPersistenceMode(options.environment);
  if (mode === "memory") {
    return options.memoryRepository ?? sessionStore;
  }
  const unitOfWork =
    options.unitOfWork ?? new PostgresUnitOfWork(options.sql ?? getPostgresClient());
  return new AuditedChatbotSessionRepository(unitOfWork, {
    now: options.now,
    createId: options.createId
  });
}

const globalRepositoryKey = "__careonroad_chatbot_session_repository__";
const globalRepository = globalThis as typeof globalThis & {
  [globalRepositoryKey]?: ChatbotSessionRepository;
};

export function getChatbotSessionRepository(): ChatbotSessionRepository {
  return (globalRepository[globalRepositoryKey] ??= createChatbotSessionRepository());
}

async function appendPersistenceEvent(
  repositories: FoundationRepositories,
  input: {
    id: string;
    entityType: "chatbot_session" | "chatbot_message" | "diagnosis_result";
    topic:
      | "chatbot.session.created"
      | "chatbot.session.claimed"
      | "chatbot.message.persisted"
      | "chatbot.diagnosis.persisted";
    status: "created" | "stored";
    sessionId?: string;
    eventType?: string;
    now: Date;
    createId: () => string;
  }
): Promise<void> {
  const payload = {
    resource_id: input.id,
    resource_type: input.entityType,
    status: input.status,
    ...(input.sessionId ? { request_id: input.sessionId } : {}),
    ...(input.eventType ? { event_type: input.eventType } : {})
  };
  await repositories.outbox.append({
    id: input.createId(),
    topic: input.topic,
    aggregateType: input.entityType,
    aggregateId: input.id,
    dedupeKey: `${input.topic}:${input.id}`,
    payload,
    createdAt: input.now,
    nextAttemptAt: input.now
  });
  await repositories.audit.append({
    id: input.createId(),
    action: input.topic,
    entityType: input.entityType,
    entityId: input.id,
    requestId: input.sessionId,
    metadata: payload,
    createdAt: input.now
  });
}
