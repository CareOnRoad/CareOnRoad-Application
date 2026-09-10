import { describe, expect, it } from "vitest";

import type { DiagnosisResult } from "@/features/chatbot/diagnosis.schema";
import { InMemorySessionStore } from "@/features/chatbot/session.store";
import {
  AuditedChatbotSessionRepository,
  createChatbotSessionRepository
} from "@/server/repositories/chatbot-session-repository.factory";
import { PostgresChatbotSessionRepository } from "@/server/repositories/postgres/chatbot-session.repository";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

const now = new Date("2026-06-30T04:00:00.000Z");

describe("chatbot session repository contract", () => {
  it("preserves the existing in-memory contract and factory mode", async () => {
    const memory = new InMemorySessionStore();
    const repository = createChatbotSessionRepository({
      environment: { CHATBOT_PERSISTENCE_MODE: "memory" },
      memoryRepository: memory
    });
    const session = await repository.createSession(now, { sessionId: uuid(1) });
    const message = await repository.appendMessage(
      session.session_id,
      {
        input_mode: "text",
        content_text: "xe kho de",
        transcribed_text: null,
        normalized_text: "xe kho de",
        safety_answers: null
      },
      now,
      { messageId: uuid(2) }
    );
    await repository.setLatestDiagnosis(session.session_id, diagnosis(), now, {
      diagnosisId: uuid(3),
      messageId: message?.message_id
    });

    await expect(Promise.resolve(repository.getSession(session.session_id))).resolves.toMatchObject({
      session_id: session.session_id,
      messages: [{ message_id: uuid(2), normalized_text: "xe kho de" }],
      latest_diagnosis: { risk_level: "medium" }
    });
    await expect(
      Promise.resolve(repository.getLatestDiagnosis(session.session_id))
    ).resolves.toEqual(diagnosis());
  });

  it("writes session, message, and diagnosis with atomic metadata-only audit/outbox", async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const repository = new AuditedChatbotSessionRepository(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        uuid(1),
        uuid(11),
        uuid(12),
        uuid(2),
        uuid(21),
        uuid(22),
        uuid(3),
        uuid(31),
        uuid(32)
      ])
    });
    const session = await repository.createSession();
    const message = await repository.appendMessage(session.session_id, {
      input_mode: "voice",
      content_text: "full private rider text",
      transcribed_text: "full private transcript",
      normalized_text: "full private normalized text",
      safety_answers: { secret: "private" }
    });
    await repository.setLatestDiagnosis(session.session_id, diagnosis(), now, {
      messageId: message?.message_id
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.chatbotSessions).toHaveLength(1);
    expect(snapshot.outboxEvents.map((event) => event.topic)).toEqual([
      "chatbot.session.created",
      "chatbot.message.persisted",
      "chatbot.diagnosis.persisted"
    ]);
    expect(snapshot.auditLogs.map((log) => log.action)).toEqual([
      "chatbot.session.created",
      "chatbot.message.persisted",
      "chatbot.diagnosis.persisted"
    ]);
    const metadata = JSON.stringify({
      outbox: snapshot.outboxEvents,
      audit: snapshot.auditLogs
    });
    for (const prohibited of [
      "full private rider text",
      "full private transcript",
      "full private normalized text",
      "private",
      diagnosis().short_answer
    ]) {
      expect(metadata).not.toContain(prohibited);
    }
  });

  it("exposes matching method surfaces for memory and PostgreSQL adapters", () => {
    const methodNames = [
      "createSession",
      "getSession",
      "appendMessage",
      "setLatestDiagnosis",
      "getLatestDiagnosis"
    ];
    for (const method of methodNames) {
      expect(typeof InMemorySessionStore.prototype[method as keyof InMemorySessionStore]).toBe(
        "function"
      );
      expect(
        typeof PostgresChatbotSessionRepository.prototype[
          method as keyof PostgresChatbotSessionRepository
        ]
      ).toBe("function");
    }
  });
});

function diagnosis(): DiagnosisResult {
  return {
    short_answer: "Cần kiểm tra bình. Giá chỉ là ước tính.",
    overall_confidence: 0.7,
    risk_level: "medium",
    can_continue_riding: true,
    top_hypotheses: [],
    estimated_total: { currency: "VND", min: 0, max: 0 },
    recommended_next_actions: [{ type: "ask_followup", label: "Kiểm tra thêm" }],
    followup_questions: [],
    fallback_used: false
  };
}

function sequentialIds(ids: string[]): () => string {
  return () => {
    const id = ids.shift();
    if (!id) throw new Error("Test ID sequence exhausted.");
    return id;
  };
}

function uuid(index: number): string {
  return `${index.toString(16).padStart(8, "0")}-eeee-4eee-8eee-${index
    .toString(16)
    .padStart(12, "0")}`;
}
