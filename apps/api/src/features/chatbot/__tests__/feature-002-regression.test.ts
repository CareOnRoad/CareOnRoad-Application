import { describe, expect, it, vi } from "vitest";

import { InMemoryRateLimiter } from "@/lib/rate-limit";
import { sanitizeLogPayload } from "@/lib/server-logger";

import { AiDiagnosisClient } from "../ai-diagnosis.client";
import { DiagnosisService } from "../diagnosis.service";
import { createFallbackDiagnosis } from "../fallback-diagnosis";
import { runSafetyGate } from "../safety-gate";
import { InMemorySessionStore } from "../session.store";
import { modelDiagnosis } from "./api-route-test-helpers";

describe("Feature 002 chatbot non-regression", () => {
  it("keeps Vietnamese advisory fallback and estimated prices without workflow mutation", () => {
    const result = createFallbackDiagnosis("xe khó đề");
    expect(result.short_answer).toMatch(/ước tính|Æ°á»›c tÃ­nh/i);
    expect(result.estimated_total.currency).toBe("VND");
    expect(result).not.toHaveProperty("assignment_id");
    expect(result).not.toHaveProperty("quote_id");
    expect(result).not.toHaveProperty("payment_id");
    expect(result).not.toHaveProperty("booking_id");
  });

  it("preserves dangerous-symptom override and Gemini-to-OpenRouter order", async () => {
    expect(runSafetyGate("mất phanh khi đang chạy")).toMatchObject({
      is_dangerous: true,
      can_continue_riding: false,
      recommended_action_type: "emergency_rescue"
    });
    const calls: string[] = [];
    const client = new AiDiagnosisClient({
      gemini: {
        createDiagnosisJson: vi.fn(async () => {
          calls.push("gemini");
          return {
            success: false as const,
            errorCode: "GEMINI_TIMEOUT",
            message: "timeout"
          };
        })
      },
      openRouter: {
        createDiagnosisJson: vi.fn(async () => {
          calls.push("openrouter");
          return {
            success: true as const,
            json: modelDiagnosis(),
            apiHttpStatus: "200",
            provider: "openrouter" as const
          };
        })
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      now: () => 1000
    });
    await client.createDiagnosisJson({
      messages: [
        { role: "system", content: "JSON only" },
        { role: "user", content: "xe khó đề" }
      ]
    });
    expect(calls).toEqual(["gemini", "openrouter"]);
  });

  it("keeps provider-failure and invalid-JSON fallback behavior", async () => {
    for (const providerResult of [
      { success: false, errorCode: "AI_ALL_PROVIDERS_UNAVAILABLE", message: "failed" },
      { success: true, json: { invalid: true }, apiHttpStatus: "200" }
    ] as const) {
      const store = new InMemorySessionStore();
      const session = store.createSession();
      const result = await new DiagnosisService({
        sessionStore: store,
        aiProvider: { createDiagnosisJson: vi.fn(async () => providerResult) },
        asr: { transcribe: vi.fn() },
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      }).diagnose({
        sessionId: session.session_id,
        input: { input_mode: "text", content_text: "xe khó đề" }
      });
      expect(result).toMatchObject({
        success: true,
        diagnosis: { fallback_used: true }
      });
    }
  });

  it("keeps local ASR boundaries, rate limits, public shape, and log redaction", async () => {
    const store = new InMemorySessionStore();
    const session = store.createSession();
    const audio = new Uint8Array([9, 8, 7]);
    const asr = {
      transcribe: vi.fn(async (input) => {
        expect(input?.data).toEqual(audio);
        return { success: true as const, text: "xe khó đề" };
      })
    };
    const provider = {
      createDiagnosisJson: vi.fn(async () => ({
        success: true as const,
        json: modelDiagnosis({ transcribed_text: "xe khó đề" }),
        apiHttpStatus: "200"
      }))
    };
    const result = await new DiagnosisService({
      sessionStore: store,
      asr,
      aiProvider: provider,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }).diagnose({
      sessionId: session.session_id,
      input: { input_mode: "voice" },
      audio: { data: audio, mimeType: "audio/wav" }
    });
    expect(result).toMatchObject({
      success: true,
      diagnosis: {
        short_answer: expect.any(String),
        estimated_total: { currency: "VND" }
      }
    });
    expect(JSON.stringify(provider.createDiagnosisJson.mock.calls)).not.toContain("9,8,7");

    const limiter = new InMemoryRateLimiter({ sessionLimit: 1, ipLimit: 10 });
    expect(
      limiter.checkDiagnosisRequest({ sessionId: "session", inputMode: "text" }).allowed
    ).toBe(true);
    expect(
      limiter.checkDiagnosisRequest({ sessionId: "session", inputMode: "text" })
    ).toMatchObject({ allowed: false, code: "AI_SESSION_LIMIT_EXCEEDED" });
    expect(
      sanitizeLogPayload({
        authorization: "Bearer private",
        raw_audio: audio,
        content_text: "full private text",
        event: "chatbot.message.received"
      })
    ).toEqual({
      text_length: 17,
      text_hash: expect.any(String),
      event: "chatbot.message.received"
    });
  });
});
