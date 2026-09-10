import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  createTextDiagnosisPayload,
  hasRecordedAudio,
  recordingStatusMessages
} from "../chat-page-draft";
import type { DiagnosisResult } from "../diagnosis.schema";
import { advisoryDisclaimer, formatVndRange, toDiagnosisViewModel } from "../chat-page-view-model";

describe("chat page rendering helpers", () => {
  it("formats diagnosis essentials for the UI", () => {
    const viewModel = toDiagnosisViewModel(diagnosisFixture());

    expect(viewModel.summary).toBe("Binh co the yeu. Gia chi la uoc tinh.");
    expect(viewModel.riskLabel).toBe("Trung bình");
    expect(viewModel.canContinueText).toBe("Chạy chậm và theo dõi");
    expect(viewModel.estimatedTotal).toBe("120.000 - 350.000 VND");
    expect(viewModel.recommendedAction).toBe("Kiem tra binh va sac");
    expect(viewModel.fallbackUsed).toBe(true);
  });

  it("caps rendered hypotheses at two items", () => {
    const diagnosis = diagnosisFixture();
    diagnosis.top_hypotheses.push({
      rank: 2,
      component_code: "UNKNOWN",
      cause: "Du lieu them",
      symptoms: "Trieu chung them",
      consequences: "Can kiem tra",
      confidence: 0.2,
      estimated_cost_min: 0,
      estimated_cost_max: 0
    });

    expect(toDiagnosisViewModel(diagnosis).hypotheses).toHaveLength(2);
  });

  it("keeps the required advisory disclaimer available to the page", () => {
    expect(advisoryDisclaimer).toBe("Kết quả chỉ mang tính tham khảo, không phải báo giá cuối cùng.");
  });

  it("formats empty estimates without final-quote wording", () => {
    expect(formatVndRange(0, 0)).toBe("Chưa ước tính");
  });

  it("renders the mic control and recording labels in the page source", () => {
    const pageSource = readFileSync(new URL("../../../../app/page.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain('aria-label="Ghi âm"');
    expect(pageSource).toContain("Dừng");
    expect(pageSource).toContain("createScriptProcessor(4096, 1, 1)");
    expect(pageSource).toContain("encodeWav(recordedChunks, sampleRate)");
    expect(pageSource).toContain("transcribeVoiceAudio(recordedAudio, \"recording.wav\")");
    expect(pageSource).toContain("sendTranscriptionRequest(activeSessionId, audioBlob, fileName)");
    expect(pageSource).toContain("/transcriptions");
    expect(pageSource).not.toContain("sendVoiceMessage");
    expect(pageSource).not.toContain('formData.append("input_mode", "voice")');
    expect(pageSource).not.toContain("canStopRecording");
    expect(pageSource).not.toContain("recordingStartedAtRef");
    expect(recordingStatusMessages.recording).toBe("Đang ghi âm...");
    expect(recordingStatusMessages.transcribing).toBe("Đang chuyển giọng nói thành văn bản...");
  });

  it("uses edited text for text Send", () => {
    const editedText = "xe khó đề và đèn yếu";
    expect(createTextDiagnosisPayload(editedText)).toEqual({
      input_mode: "text",
      content_text: "xe khó đề và đèn yếu"
    });
  });

  it("rejects empty browser recordings before ASR upload", () => {
    expect(hasRecordedAudio(new Blob([]))).toBe(false);
    expect(hasRecordedAudio(new Blob(["audio"]))).toBe(true);
  });
});

function diagnosisFixture(): DiagnosisResult {
  return {
    short_answer: "Binh co the yeu. Gia chi la uoc tinh.",
    overall_confidence: 0.7,
    risk_level: "medium",
    can_continue_riding: true,
    top_hypotheses: [
      {
        rank: 1,
        component_code: "BATTERY",
        cause: "Binh ac quy yeu",
        symptoms: "Den yeu, kho de",
        consequences: "Co the khong de duoc",
        confidence: 0.74,
        estimated_cost_min: 120000,
        estimated_cost_max: 350000
      },
      {
        rank: 2,
        component_code: "ELECTRICAL_SYSTEM",
        cause: "He thong sac kem",
        symptoms: "Dien chap chon",
        consequences: "Binh nhanh het",
        confidence: 0.52,
        estimated_cost_min: 150000,
        estimated_cost_max: 450000
      }
    ],
    estimated_total: {
      currency: "VND",
      min: 120000,
      max: 350000
    },
    recommended_next_actions: [
      {
        type: "book_mobile_repair",
        label: "Kiem tra binh va sac"
      }
    ],
    followup_questions: [],
    fallback_used: true
  };
}
