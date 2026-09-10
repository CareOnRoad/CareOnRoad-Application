import { describe, expect, it, vi } from "vitest";

import { InMemoryRateLimiter } from "@/lib/rate-limit";
import { AuditedChatbotSessionRepository } from "@/server/repositories/chatbot-session-repository.factory";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import {
  createMessageResponse,
  createSessionResponse,
  getLatestDiagnosisResponse
} from "../api-routes";
import { DiagnosisService } from "../diagnosis.service";
import {
  createJsonRequest,
  modelDiagnosis,
  responseJson
} from "./api-route-test-helpers";

const now = new Date("2026-06-30T04:00:00.000Z");

describe("chatbot persistence integration", () => {
  it("persists through existing APIs and restores latest diagnosis after repository restart", async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const repository = createRepository(unitOfWork);
    const sessionResponse = await createSessionResponse({ repository });
    const sessionBody = await responseJson<{ session_id: string }>(sessionResponse);
    const service = new DiagnosisService({
      sessionRepository: repository,
      aiProvider: {
        createDiagnosisJson: vi.fn(async () => ({
          success: true as const,
          json: modelDiagnosis(),
          apiHttpStatus: "200",
          provider: "gemini" as const
        }))
      },
      asr: { transcribe: vi.fn() },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      now: () => now.getTime()
    });

    const messageResponse = await createMessageResponse(
      createJsonRequest({
        input_mode: "text",
        content_text: "xe khó đề và đèn yếu"
      }),
      sessionBody.session_id,
      {
        diagnosis: service,
        rateLimiter: new InMemoryRateLimiter({ sessionLimit: 10, ipLimit: 10 })
      }
    );
    const diagnosisBody = await responseJson(messageResponse);
    expect(messageResponse.status).toBe(200);
    expect(diagnosisBody).toMatchObject({
      short_answer: expect.any(String),
      estimated_total: { currency: "VND" },
      fallback_used: false
    });

    const restartedRepository = new AuditedChatbotSessionRepository(unitOfWork, {
      now: () => now
    });
    const restoredResponse = await getLatestDiagnosisResponse(sessionBody.session_id, {
      repository: restartedRepository
    });
    await expect(responseJson(restoredResponse)).resolves.toEqual({
      session_id: sessionBody.session_id,
      diagnosis: diagnosisBody
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.outboxEvents).toHaveLength(3);
    expect(snapshot.auditLogs).toHaveLength(3);
    const metadata = JSON.stringify({
      outbox: snapshot.outboxEvents,
      audit: snapshot.auditLogs
    });
    expect(metadata).not.toContain("xe khó đề");
    expect(metadata).not.toContain(modelDiagnosis().short_answer);
  });
});

function createRepository(unitOfWork: InMemoryUnitOfWork) {
  const ids = Array.from({ length: 9 }, (_, index) => uuid(index + 1));
  return new AuditedChatbotSessionRepository(unitOfWork, {
    now: () => now,
    createId: () => {
      const id = ids.shift();
      if (!id) throw new Error("Test ID sequence exhausted.");
      return id;
    }
  });
}

function uuid(index: number): string {
  return `${index.toString(16).padStart(8, "0")}-ffff-4fff-8fff-${index
    .toString(16)
    .padStart(12, "0")}`;
}
