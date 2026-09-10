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
  it("uses Gemini first and does not call OpenRouter when Gemini succeeds", async () => {
    const geminiResult: AiProviderResult = {
      success: true,
      provider: "gemini",
      providerModel: "gemini-2.5-flash-lite",
      apiHttpStatus: "200",
      json: { short_answer: "Gemini ok." }
    };
    const { client, gemini, openRouter } = createClient({
      geminiResult
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toEqual(geminiResult);
    expect(gemini.createDiagnosisJson).toHaveBeenCalledOnce();
    expect(openRouter.createDiagnosisJson).not.toHaveBeenCalled();
  });

  it("falls back to OpenRouter within the remaining total timeout budget", async () => {
    const { client, gemini, openRouter } = createClient({
      geminiResult: {
        success: false,
        provider: "gemini",
        errorCode: "GEMINI_TIMEOUT",
        message: "timeout"
      },
      openRouterResult: {
        success: true,
        provider: "openrouter",
        apiHttpStatus: "200",
        json: { short_answer: "OpenRouter ok." }
      }
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({
      success: true,
      provider: "openrouter"
    });
    expect(gemini.createDiagnosisJson).toHaveBeenCalledWith(
      prompt,
      expect.objectContaining({
        retryWithRetryAfter: false,
        timeoutMs: 6000
      })
    );
    expect(openRouter.createDiagnosisJson).toHaveBeenCalledWith(
      prompt,
      expect.objectContaining({
        retryWithRetryAfter: false,
        timeoutMs: 4000
      })
    );
  });

  it("does not call OpenRouter after Gemini exhausts the total timeout", async () => {
    let currentTime = 1000;
    const { client, openRouter } = createClient({
      now: () => currentTime,
      geminiResult: {
        success: false,
        provider: "gemini",
        errorCode: "GEMINI_TIMEOUT",
        message: "timeout"
      },
      afterGemini: () => {
        currentTime = 11_001;
      }
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({
      success: false,
      errorCode: "GEMINI_TIMEOUT"
    });
    expect(openRouter.createDiagnosisJson).not.toHaveBeenCalled();
  });

  it("skips a circuit-open provider and tries the next provider", async () => {
    const circuitBreaker = new ProviderCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 60_000,
      now: () => 1000
    });
    circuitBreaker.recordFailure("gemini");
    const { client, gemini, openRouter, records } = createClient({
      circuitBreaker,
      openRouterResult: {
        success: true,
        provider: "openrouter",
        apiHttpStatus: "200",
        json: { short_answer: "OpenRouter ok." }
      }
    });

    const result = await client.createDiagnosisJson(prompt);

    expect(result).toMatchObject({
      success: true,
      provider: "openrouter"
    });
    expect(gemini.createDiagnosisJson).not.toHaveBeenCalled();
    expect(openRouter.createDiagnosisJson).toHaveBeenCalledOnce();
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
  openRouterResult?: AiProviderResult;
  now?: () => number;
  afterGemini?: () => void;
  circuitBreaker?: ProviderCircuitBreaker;
} = {}) {
  const records: LogEvent[] = [];
  const gemini = {
    createDiagnosisJson: vi.fn(async () => {
      const result =
        options.geminiResult ??
        ({
          success: false,
          provider: "gemini",
          errorCode: "GEMINI_PROVIDER_ERROR",
          message: "provider error"
        } satisfies AiProviderResult);
      options.afterGemini?.();
      return result;
    })
  };
  const openRouter = {
    createDiagnosisJson: vi.fn(
      async () =>
        options.openRouterResult ??
        ({
          success: false,
          provider: "openrouter",
          errorCode: "OPENROUTER_PROVIDER_ERROR",
          message: "provider error"
        } satisfies AiProviderResult)
    )
  };

  return {
    records,
    gemini,
    openRouter,
    client: new AiDiagnosisClient({
      env: {
        NODE_ENV: "test",
        AI_TOTAL_TIMEOUT_MS: "10000",
        GEMINI_TIMEOUT_MS: "6000",
        OPENROUTER_TIMEOUT_MS: "4000"
      },
      gemini,
      openRouter,
      logger: {
        info: (payload) => records.push(payload),
        warn: (payload) => records.push(payload),
        error: (payload) => records.push(payload)
      },
      now: options.now ?? (() => 1000),
      circuitBreaker: options.circuitBreaker
    })
  };
}
