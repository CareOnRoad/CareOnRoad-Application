import { describe, expect, it, vi } from "vitest";

import type { LogEvent } from "@/lib/server-logger";

import { AiDiagnosisClient, ProviderCircuitBreaker } from "../ai-diagnosis.client";
import type { AiProviderResult } from "../ai-provider.types";

const prompt = {
  messages: [
    {
      role: "system" as const,
      content: "JSON only"
    },
    {
      role: "user" as const,
      content: "xe kho de"
    }
  ]
};

describe("AiDiagnosisClient", () => {
  it("returns the Gemini result within the configured timeout", async () => {
    const geminiResult: AiProviderResult = {
      success: true,
      provider: "gemini",
      providerModel: "gemini-3.5-flash-lite",
      apiHttpStatus: "200",
      json: { short_answer: "Gemini ok." }
    };
    const { client, gemini } = createClient({ geminiResult });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toEqual(geminiResult);
    expect(gemini.createDiagnosisJson).toHaveBeenCalledWith(
      prompt,
      expect.objectContaining({ retryWithRetryAfter: false, timeoutMs: 6000 })
    );
  });

  it("returns the Gemini failure so the service can use the local fallback", async () => {
    const { client } = createClient({
      geminiResult: {
        success: false,
        provider: "gemini",
        errorCode: "GEMINI_TIMEOUT",
        message: "timeout"
      }
    });

    await expect(client.createDiagnosisJson(prompt)).resolves.toMatchObject({
      success: false,
      errorCode: "GEMINI_TIMEOUT",
      provider: "gemini"
    });
  });

  it("skips Gemini while its circuit is open", async () => {
    const circuitBreaker = new ProviderCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 60_000,
      now: () => 1000
    });
    circuitBreaker.recordFailure("gemini");
    const { client, gemini, records } = createClient({ circuitBreaker });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({ success: false, errorCode: "AI_PROVIDER_CIRCUIT_OPEN" });
    expect(gemini.createDiagnosisJson).not.toHaveBeenCalled();
    expect(records).toContainEqual(
      expect.objectContaining({
        event: "chatbot.ai_provider.skipped",
        provider: "gemini",
        error_code: "AI_PROVIDER_CIRCUIT_OPEN"
      })
    );
  });
});

function createClient(options: {
  geminiResult?: AiProviderResult;
  circuitBreaker?: ProviderCircuitBreaker;
} = {}) {
  const records: LogEvent[] = [];
  const gemini = {
    createDiagnosisJson: vi.fn(
      async () =>
        options.geminiResult ??
        ({
          success: false,
          provider: "gemini",
          errorCode: "GEMINI_PROVIDER_ERROR",
          message: "provider error"
        } satisfies AiProviderResult)
    )
  };

  return {
    records,
    gemini,
    client: new AiDiagnosisClient({
      env: {
        NODE_ENV: "test",
        AI_TOTAL_TIMEOUT_MS: "10000",
        GEMINI_TIMEOUT_MS: "6000"
      },
      gemini,
      logger: {
        info: (payload) => records.push(payload),
        warn: (payload) => records.push(payload),
        error: (payload) => records.push(payload)
      },
      now: () => 1000,
      circuitBreaker: options.circuitBreaker
    })
  };
}
