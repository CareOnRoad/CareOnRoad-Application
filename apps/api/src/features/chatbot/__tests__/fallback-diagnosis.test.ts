import { describe, expect, it } from "vitest";

import { diagnosisSchema } from "../diagnosis.schema";
import { createFallbackDiagnosis } from "../fallback-diagnosis";

function sentenceCount(value: string): number {
  return value
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}

describe("createFallbackDiagnosis", () => {
  it("returns valid diagnosis schema for normal input", () => {
    const diagnosis = createFallbackDiagnosis("Xe khó đề và hao xăng hơn bình thường");

    expect(diagnosisSchema.safeParse(diagnosis).success).toBe(true);
    expect(diagnosis.fallback_used).toBe(true);
    expect(diagnosis.top_hypotheses.length).toBeLessThanOrEqual(2);
    expect(diagnosis.recommended_next_actions.length).toBeLessThanOrEqual(2);
    expect(diagnosis.followup_questions.length).toBeLessThanOrEqual(2);
  });

  it("forces emergency rescue for dangerous input", () => {
    const diagnosis = createFallbackDiagnosis("Xe đang chạy bị mất phanh và có mùi cháy");

    expect(["high", "critical"]).toContain(diagnosis.risk_level);
    expect(diagnosis.can_continue_riding).toBe(false);
    expect(diagnosis.recommended_next_actions.some((action) => action.type === "emergency_rescue")).toBe(
      true
    );
    expect(diagnosis.short_answer).toContain("Dừng xe");
  });

  it("keeps fallback output compact", () => {
    const diagnosis = createFallbackDiagnosis("Xe đèn yếu và bình yếu");

    expect(sentenceCount(diagnosis.short_answer)).toBeLessThanOrEqual(3);
    expect(diagnosis.top_hypotheses).toHaveLength(1);
    expect(diagnosis.recommended_next_actions.length).toBeLessThanOrEqual(2);
    expect(diagnosis.followup_questions.length).toBeLessThanOrEqual(2);
  });

  it("uses UNKNOWN when no relevant knowledge is found", () => {
    const diagnosis = createFallbackDiagnosis("Xe có triệu chứng lạ chưa rõ");

    expect(diagnosis.top_hypotheses).toHaveLength(1);
    expect(diagnosis.top_hypotheses[0]?.component_code).toBe("UNKNOWN");
    expect(diagnosis.followup_questions.length).toBe(1);
  });

  it("includes transcribed text when provided", () => {
    const diagnosis = createFallbackDiagnosis("Xe khó đề", {
      transcribedText: "Xe khó đề"
    });

    expect(diagnosis.transcribed_text).toBe("Xe khó đề");
  });

  it("asks symptom-specific questions and avoids unverified repair prices", () => {
    const diagnosis = createFallbackDiagnosis("nhớt trắng sữa");
    expect(diagnosis.top_hypotheses[0]?.component_code).toBe("ENGINE_OIL");
    expect(diagnosis.can_continue_riding).toBe(false);
    expect(diagnosis.followup_questions[0]).toContain("ngập nước");
    expect(diagnosis.estimated_total).toMatchObject({ min: 0, max: 0 });
    expect(diagnosis.short_answer).toContain("Chưa có ước tính");
  });

  it("asks neutrally instead of diagnosing pending charging knowledge", () => {
    const diagnosis = createFallbackDiagnosis("sạc không vào");
    expect(diagnosis.top_hypotheses[0]?.component_code).toBe("UNKNOWN");
    expect(diagnosis.followup_questions[0]).toContain("mẫu xe");
  });
});
