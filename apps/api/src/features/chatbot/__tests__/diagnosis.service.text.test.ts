import { describe, expect, it, vi } from "vitest";

import type { LogEvent } from "@/lib/server-logger";

import { DiagnosisService } from "../diagnosis.service";
import type { DiagnosisResult } from "../diagnosis.schema";
import { knowledgeReviewedAt, knowledgeVersion } from "../knowledge-sources";
import type { OpenRouterResult } from "../openrouter.client";
import { InMemorySessionStore } from "../session.store";

describe("DiagnosisService text orchestration", () => {
  it.each([false, true])("persists the PH manual source only for an applicable Raider FI, fallback %s", async (fallback) => {
    const { service, store } = setup({ openRouterResult: fallback
      ? { success: false, errorCode: "OPENROUTER_TIMEOUT", message: "timeout" }
      : { success: true, json: modelDiagnosis(), apiHttpStatus: "200" } });
    const session = store.createSession();
    const result = await service.diagnose({ sessionId: session.session_id,
      input: { input_mode: "text", content_text: "Suzuki Raider FI bản Philippines đèn báo FI" } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.knowledge_provenance).toEqual({
      version: knowledgeVersion, reviewed_at: knowledgeReviewedAt,
      entry_ids: ["suzuki-ph-raider-fi-mil-warning"], source_ids: ["suzuki-ph-raider-fi-manual"]
    });
    expect(result.diagnosis.top_hypotheses[0]?.component_code).toBe("FUEL_SYSTEM");
    expect(store.getLatestDiagnosis(session.session_id)?.knowledge_provenance).toEqual(result.diagnosis.knowledge_provenance);
  });

  it.each([false, true])("asks for the Raider variant instead of adopting a provider's component guess, fallback %s", async (fallback) => {
    const { service, store } = setup({ openRouterResult: fallback
      ? { success: false, errorCode: "OPENROUTER_TIMEOUT", message: "timeout" }
      : { success: true, json: {
          ...modelDiagnosis(),
          recommended_next_actions: [{ type: "book_mobile_repair", label: "Thay binh ac quy" }],
          followup_questions: ["Thay binh moi chua?"]
        }, apiHttpStatus: "200" } });
    const session = store.createSession();
    const result = await service.diagnose({ sessionId: session.session_id,
      input: { input_mode: "text", content_text: "Suzuki Raider FI đèn FI" } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.top_hypotheses).toHaveLength(1);
    expect(result.diagnosis.top_hypotheses[0]).toMatchObject({ component_code: "UNKNOWN" });
    expect(result.diagnosis.top_hypotheses[0]?.cause).toContain("xác nhận phiên bản Raider");
    expect(result.diagnosis.overall_confidence).toBeLessThanOrEqual(0.35);
    expect(result.diagnosis.followup_questions.join(" ")).toContain("Philippines");
    expect(result.diagnosis.recommended_next_actions).toEqual([
      { type: "ask_followup", label: "Xác nhận đời xe, FI hay bình xăng con và thị trường xe" }
    ]);
    expect(result.diagnosis.knowledge_provenance?.source_ids).toEqual([]);
  });

  it.each([false, true])("stores backend knowledge provenance when provider fallback is %s", async (fallback) => {
    const { service, store } = setup({ openRouterResult: fallback
      ? { success: false, errorCode: "OPENROUTER_TIMEOUT", message: "timeout" }
      : { success: true, json: {
          ...modelDiagnosis(),
          knowledge_provenance: { version: "provider-invented", reviewed_at: "2000-01-01", entry_ids: [], source_ids: [] }
        }, apiHttpStatus: "200" } });
    const session = store.createSession();
    const result = await service.diagnose({ sessionId: session.session_id,
      input: { input_mode: "text", content_text: "nhớt trắng sữa" } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.knowledge_provenance).toEqual({
      version: knowledgeVersion, reviewed_at: knowledgeReviewedAt,
      entry_ids: ["oil-contaminated-after-flood"], source_ids: ["yamaha-flood", "yamaha-oil-check"]
    });
    expect(store.getLatestDiagnosis(session.session_id)?.knowledge_provenance).toEqual(result.diagnosis.knowledge_provenance);
  });

  it.each([false, true])("keeps shutdown safety override when provider fallback is %s", async (fallback) => {
    const { service, store } = setup({ openRouterResult: fallback
      ? { success: false, errorCode: "OPENROUTER_TIMEOUT", message: "timeout" }
      : { success: true, json: { ...modelDiagnosis(), risk_level: "low", can_continue_riding: true }, apiHttpStatus: "200" } });
    const session = store.createSession();
    const result = await service.diagnose({ sessionId: session.session_id,
      input: { input_mode: "text", content_text: "Xe đang chạy thì chết máy" } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis).toMatchObject({ can_continue_riding: false, fallback_used: fallback });
    expect(["high", "critical"]).toContain(result.diagnosis.risk_level);
    expect(result.diagnosis.recommended_next_actions[0]?.type).toBe("emergency_rescue");
  });
  it("returns valid compact diagnosis for normal text input and stores latest diagnosis", async () => {
    const { service, store } = setup({
      openRouterResult: { success: true, json: modelDiagnosis(), apiHttpStatus: "200" }
    });
    const session = store.createSession(new Date("2026-06-16T00:00:00.000Z"));

    const result = await service.diagnose({
      sessionId: session.session_id,
      requestId: "req-1",
      input: { input_mode: "text", content_text: "xe kho de va den yeu" }
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.fallback_used).toBe(false);
    expect(result.diagnosis.top_hypotheses.length).toBeLessThanOrEqual(2);
    expect(store.getLatestDiagnosis(session.session_id)).toEqual(result.diagnosis);
    expect(store.getSession(session.session_id)?.messages[0]).toMatchObject({
      input_mode: "text",
      normalized_text: "xe kho de va den yeu"
    });
  });

  it("overrides dangerous text input over a low-risk model response", async () => {
    const { service, store } = setup({
      openRouterResult: {
        success: true,
        json: {
          ...modelDiagnosis(),
          risk_level: "low",
          can_continue_riding: true,
          recommended_next_actions: [{ type: "safe_to_monitor", label: "Theo doi" }]
        },
        apiHttpStatus: "200"
      }
    });
    const session = store.createSession();

    const result = await service.diagnose({
      sessionId: session.session_id,
      input: { input_mode: "text", content_text: "mat phanh khi dang chay" }
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(["high", "critical"]).toContain(result.diagnosis.risk_level);
    expect(result.diagnosis.can_continue_riding).toBe(false);
    expect(result.diagnosis.recommended_next_actions[0]?.type).toBe("emergency_rescue");
    expect(result.diagnosis.short_answer).toContain("Dung xe");
  });

  it("uses fallback diagnosis when OpenRouter is missing API key or fails", async () => {
    const { service, store } = setup({
      openRouterResult: {
        success: false,
        errorCode: "OPENROUTER_MISSING_API_KEY",
        message: "missing"
      }
    });
    const session = store.createSession();

    const result = await service.diagnose({
      sessionId: session.session_id,
      input: { input_mode: "text", content_text: "xe kho de" }
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.fallback_used).toBe(true);
  });

  it("uses fallback diagnosis for timeout, invalid provider content, schema-invalid output, and unsafe post-validation", async () => {
    for (const openRouterResult of [
      { success: false, errorCode: "OPENROUTER_TIMEOUT", message: "timeout" } satisfies OpenRouterResult,
      { success: false, errorCode: "OPENROUTER_INVALID_RESPONSE", message: "invalid" } satisfies OpenRouterResult,
      { success: true, json: { short_answer: "bad" }, apiHttpStatus: "200" } satisfies OpenRouterResult,
      { success: true, json: null, apiHttpStatus: "200" } satisfies OpenRouterResult
    ]) {
      const { service, store } = setup({ openRouterResult });
      const session = store.createSession();

      const result = await service.diagnose({
        sessionId: session.session_id,
        input: { input_mode: "text", content_text: "xe den yeu" }
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.diagnosis.fallback_used).toBe(true);
    }
  });

  it("logs diagnosis completion metadata without full symptom text or API key", async () => {
    const { service, store, records } = setup({
      openRouterResult: { success: true, json: modelDiagnosis(), apiHttpStatus: "200" }
    });
    const session = store.createSession();
    const fullText = "xe kho de va den yeu full symptom text";

    const result = await service.diagnose({
      sessionId: session.session_id,
      requestId: "req-logs",
      input: { input_mode: "text", content_text: fullText }
    });

    expect(result.success).toBe(true);
    const completed = records.find((record) => record.event === "chatbot.diagnosis.completed");
    expect(completed).toMatchObject({
      fallback_used: false,
      risk_level: "medium"
    });
    const serializedLogs = JSON.stringify(records);
    expect(serializedLogs).not.toContain(fullText);
    expect(serializedLogs).not.toContain("secret-api-key");
    expect(serializedLogs).toContain("text_hash");
  });
});

function setup(options: { openRouterResult: OpenRouterResult }) {
  const store = new InMemorySessionStore();
  const records: LogEvent[] = [];
  const openRouter = {
    createDiagnosisJson: vi.fn(async () => options.openRouterResult)
  };
  const service = new DiagnosisService({
    sessionStore: store,
    openRouter,
    asr: {
      transcribe: vi.fn()
    },
    logger: {
      info: (payload) => records.push(payload),
      warn: (payload) => records.push(payload),
      error: (payload) => records.push(payload)
    },
    now: () => 1000
  });

  return { service, store, records, openRouter };
}

function modelDiagnosis(): DiagnosisResult {
  return {
    short_answer: "Can kiem tra binh. Gia chi la uoc tinh.",
    overall_confidence: 0.72,
    risk_level: "medium",
    can_continue_riding: true,
    top_hypotheses: [
      {
        rank: 1,
        component_code: "BATTERY",
        cause: "Binh yeu",
        symptoms: "Kho de va den yeu",
        consequences: "Co the khong de duoc",
        confidence: 0.7,
        estimated_cost_min: 150000,
        estimated_cost_max: 450000
      }
    ],
    estimated_total: {
      currency: "VND",
      min: 150000,
      max: 450000
    },
    recommended_next_actions: [
      {
        type: "book_mobile_repair",
        label: "Kiem tra binh"
      }
    ],
    followup_questions: [],
    fallback_used: false
  };
}
