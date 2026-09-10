import { describe, expect, it, vi } from "vitest";

import type { AsrResult } from "@/features/asr";
import type { LogEvent } from "@/lib/server-logger";

import { DiagnosisService } from "../diagnosis.service";
import type { DiagnosisResult } from "../diagnosis.schema";
import type { OpenRouterResult } from "../openrouter.client";
import { InMemorySessionStore } from "../session.store";

describe("DiagnosisService voice orchestration", () => {
  it("calls ASR, uses transcribed text, and runs the diagnosis pipeline", async () => {
    const { service, store, asr, openRouter } = setup({
      asrResult: { success: true, text: "xe kho de va den yeu" },
      openRouterResult: {
        success: true,
        json: { ...modelDiagnosis(), transcribed_text: "xe kho de va den yeu" },
        apiHttpStatus: "200"
      }
    });
    const session = store.createSession();

    const result = await service.diagnose({
      sessionId: session.session_id,
      input: { input_mode: "voice" },
      audio: {
        data: new Uint8Array([1, 2, 3, 4]),
        mimeType: "audio/wav",
        fileName: "voice.wav"
      }
    });

    expect(asr.transcribe).toHaveBeenCalledOnce();
    expect(openRouter.createDiagnosisJson).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.transcribed_text).toBe("xe kho de va den yeu");
    expect(store.getSession(session.session_id)?.messages[0]).toMatchObject({
      input_mode: "voice",
      content_text: "xe kho de va den yeu",
      transcribed_text: "xe kho de va den yeu",
      normalized_text: "xe kho de va den yeu"
    });
  });

  it("returns controlled error for empty ASR transcription and does not call OpenRouter", async () => {
    const { service, store, openRouter } = setup({
      asrResult: { success: true, text: "   " },
      openRouterResult: { success: true, json: modelDiagnosis(), apiHttpStatus: "200" }
    });
    const session = store.createSession();

    const result = await service.diagnose({
      sessionId: session.session_id,
      input: { input_mode: "voice" },
      audio: { data: new Uint8Array([1]), mimeType: "audio/wav", fileName: "voice.wav" }
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: "ASR_EMPTY_TRANSCRIPTION"
    });
    expect(openRouter.createDiagnosisJson).not.toHaveBeenCalled();
  });

  it("returns controlled ASR failure and does not call OpenRouter", async () => {
    const { service, store, openRouter } = setup({
      asrResult: {
        success: false,
        errorCode: "ASR_NOT_AVAILABLE",
        message: "ASR unavailable"
      },
      openRouterResult: { success: true, json: modelDiagnosis(), apiHttpStatus: "200" }
    });
    const session = store.createSession();

    const result = await service.diagnose({
      sessionId: session.session_id,
      input: { input_mode: "voice" },
      audio: { data: new Uint8Array([1]), mimeType: "audio/wav", fileName: "voice.wav" }
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: "ASR_NOT_AVAILABLE"
    });
    expect(openRouter.createDiagnosisJson).not.toHaveBeenCalled();
  });

  it("does not log raw audio bytes", async () => {
    const { service, store, records } = setup({
      asrResult: { success: true, text: "xe kho de" },
      openRouterResult: { success: true, json: modelDiagnosis(), apiHttpStatus: "200" }
    });
    const session = store.createSession();

    await service.diagnose({
      sessionId: session.session_id,
      input: { input_mode: "voice" },
      audio: { data: new Uint8Array([9, 8, 7]), mimeType: "audio/wav", fileName: "voice.wav" }
    });

    const serializedLogs = JSON.stringify(records);
    expect(serializedLogs).not.toContain("9,8,7");
    expect(serializedLogs).not.toContain("raw_audio");
  });
});

function setup(options: { asrResult: AsrResult; openRouterResult: OpenRouterResult }) {
  const store = new InMemorySessionStore();
  const records: LogEvent[] = [];
  const asr = {
    transcribe: vi.fn(async () => options.asrResult)
  };
  const openRouter = {
    createDiagnosisJson: vi.fn(async () => options.openRouterResult)
  };
  const service = new DiagnosisService({
    sessionStore: store,
    asr,
    openRouter,
    logger: {
      info: (payload) => records.push(payload),
      warn: (payload) => records.push(payload),
      error: (payload) => records.push(payload)
    },
    now: () => 1000
  });

  return { service, store, records, asr, openRouter };
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
