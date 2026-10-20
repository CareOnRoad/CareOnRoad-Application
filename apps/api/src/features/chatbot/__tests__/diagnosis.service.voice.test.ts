import { describe, expect, it, vi } from "vitest";

import type { AsrResult } from "@/features/asr";
import type { LogEvent } from "@/lib/server-logger";

import { DiagnosisService } from "../diagnosis.service";
import type { DiagnosisResult } from "../diagnosis.schema";
import type { AiProviderResult } from "../ai-provider.types";
import { InMemorySessionStore } from "../session.store";

describe("DiagnosisService voice orchestration", () => {
  it("calls ASR, uses transcribed text, and runs the diagnosis pipeline", async () => {
    const { service, store, asr, aiProvider } = setup({
      asrResult: { success: true, text: "xe kho de va den yeu" },
      aiResult: {
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
    expect(aiProvider.createDiagnosisJson).toHaveBeenCalledOnce();
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

  it("returns controlled error for empty ASR transcription and does not call the AI provider", async () => {
    const { service, store, aiProvider } = setup({
      asrResult: { success: true, text: "   " },
      aiResult: { success: true, json: modelDiagnosis(), apiHttpStatus: "200" }
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
    expect(aiProvider.createDiagnosisJson).not.toHaveBeenCalled();
  });

  it("returns controlled ASR failure and does not call the AI provider", async () => {
    const { service, store, aiProvider } = setup({
      asrResult: {
        success: false,
        errorCode: "ASR_NOT_AVAILABLE",
        message: "ASR unavailable"
      },
      aiResult: { success: true, json: modelDiagnosis(), apiHttpStatus: "200" }
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
    expect(aiProvider.createDiagnosisJson).not.toHaveBeenCalled();
  });

  it("does not log raw audio bytes", async () => {
    const { service, store, records } = setup({
      asrResult: { success: true, text: "xe kho de" },
      aiResult: { success: true, json: modelDiagnosis(), apiHttpStatus: "200" }
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

function setup(options: { asrResult: AsrResult; aiResult: AiProviderResult }) {
  const store = new InMemorySessionStore();
  const records: LogEvent[] = [];
  const asr = {
    transcribe: vi.fn(async () => options.asrResult)
  };
  const aiProvider = {
    createDiagnosisJson: vi.fn(async () => options.aiResult)
  };
  const service = new DiagnosisService({
    sessionStore: store,
    asr,
    aiProvider,
    logger: {
      info: (payload) => records.push(payload),
      warn: (payload) => records.push(payload),
      error: (payload) => records.push(payload)
    },
    now: () => 1000
  });

  return { service, store, records, asr, aiProvider };
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
