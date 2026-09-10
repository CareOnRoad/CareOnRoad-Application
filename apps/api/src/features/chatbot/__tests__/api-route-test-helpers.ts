import { vi } from "vitest";

import type { AsrResult } from "@/features/asr";
import type { LogEvent } from "@/lib/server-logger";

import { DiagnosisService } from "../diagnosis.service";
import type { DiagnosisResult } from "../diagnosis.schema";
import type { OpenRouterResult } from "../openrouter.client";
import { InMemorySessionStore } from "../session.store";

export function createJsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/chatbot/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

export function createVoiceRequest(
  options: {
    includeAudio?: boolean;
    safetyAnswers?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
) {
  const formData = new FormData();
  formData.set("input_mode", "voice");

  if (options.includeAudio ?? true) {
    formData.set("audio_file", new File([new Uint8Array([1, 2, 3, 4])], "voice.wav", { type: "audio/wav" }));
  }

  if (options.safetyAnswers) {
    formData.set("safety_answers", JSON.stringify(options.safetyAnswers));
  }

  return new Request("http://localhost/api/chatbot/test", {
    method: "POST",
    headers: options.headers,
    body: formData
  });
}

export async function responseJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function setupDiagnosisRoute(options: {
  asrResult?: AsrResult;
  openRouterResult?: OpenRouterResult;
}) {
  const store = new InMemorySessionStore();
  const records: LogEvent[] = [];
  const asr = {
    transcribe: vi.fn(async (): Promise<AsrResult> => options.asrResult ?? { success: true, text: "xe kho de va den yeu" })
  };
  const openRouter = {
    createDiagnosisJson: vi.fn(
      async (): Promise<OpenRouterResult> =>
        options.openRouterResult ?? { success: true, json: modelDiagnosis(), apiHttpStatus: "200" }
    )
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

  return { store, records, asr, openRouter, service };
}

export function modelDiagnosis(overrides: Partial<DiagnosisResult> = {}): DiagnosisResult {
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
    fallback_used: false,
    ...overrides
  };
}
