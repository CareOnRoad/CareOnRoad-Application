import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { AuditedChatbotSessionRepository } from "@/server/repositories/chatbot-session-repository.factory";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { DiagnosisService } from "../diagnosis.service";
import { InMemorySessionStore } from "../session.store";
import { modelDiagnosis } from "./api-route-test-helpers";

const sampleCount = 20;

describe("chatbot persistence latency local regression smoke", () => {
  it("keeps repository-backed median within the documented generous allowance", async () => {
    const memoryRepository = new InMemorySessionStore();
    const persistedRepository = new AuditedChatbotSessionRepository(
      new InMemoryUnitOfWork()
    );
    const baseline = await measureDiagnosisRequests(memoryRepository, "memory");
    const persisted = await measureDiagnosisRequests(persistedRepository, "repository");
    const baselineMedian = median(baseline);
    const persistedMedian = median(persisted);
    const allowanceMs = Math.max(250, baselineMedian * 3);

    expect(baseline).toHaveLength(sampleCount);
    expect(persisted).toHaveLength(sampleCount);
    expect(persistedMedian - baselineMedian).toBeLessThanOrEqual(allowanceMs);
  }, 30_000);
});

async function measureDiagnosisRequests(
  repository: InMemorySessionStore | AuditedChatbotSessionRepository,
  label: string
): Promise<number[]> {
  const service = new DiagnosisService({
    sessionRepository: repository,
    aiProvider: {
      createDiagnosisJson: async () => ({
        success: true as const,
        json: modelDiagnosis(),
        apiHttpStatus: "200",
        provider: "gemini" as const
      })
    },
    asr: {
      transcribe: async () => {
        throw new Error("ASR must remain unused in the text latency smoke test.");
      }
    },
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    now: () => Date.now()
  });
  const sessions = await Promise.all(
    Array.from({ length: sampleCount }, (_, index) =>
      repository.createSession(new Date("2026-06-30T08:00:00.000Z"), {
        sessionId: uuid(label === "memory" ? index + 1 : index + 101)
      })
    )
  );
  const durations: number[] = [];

  for (let index = 0; index < sessions.length; index += 1) {
    const startedAt = performance.now();
    const result = await service.diagnose({
      sessionId: sessions[index]!.session_id,
      requestId: `${label}-${index}`,
      input: {
        input_mode: "text",
        content_text: "xe kho de va den yeu"
      }
    });
    durations.push(performance.now() - startedAt);
    expect(result.success).toBe(true);
  }
  return durations;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function uuid(index: number): string {
  return `40000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}
