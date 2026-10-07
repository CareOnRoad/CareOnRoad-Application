import { describe, expect, it } from "vitest";

import { diagnosisSchema } from "../diagnosis.schema";
import { postValidateDiagnosis } from "../post-validation";
import { retrieveKnowledge } from "../retrieval";
import { runSafetyGate } from "../safety-gate";

describe("postValidateDiagnosis", () => {
  it("discards provider price ranges without a verified repair-price source", () => {
    const result = postValidateDiagnosis(
      {
        ...modelDiagnosis(),
        estimated_total: { currency: "VND", min: 500000, max: 100000 },
        top_hypotheses: [
          {
            ...modelDiagnosis().top_hypotheses[0],
            estimated_cost_min: 300000,
            estimated_cost_max: 100000
          }
        ]
      },
      runSafetyGate("xe kho de")
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.estimated_total).toMatchObject({ min: 0, max: 0 });
    expect(result.diagnosis.top_hypotheses[0]).toMatchObject({
      estimated_cost_min: 0,
      estimated_cost_max: 0
    });
    expect(diagnosisSchema.safeParse(result.diagnosis).success).toBe(true);
  });

  it("converts invalid component codes to UNKNOWN and reduces confidence", () => {
    const result = postValidateDiagnosis(
      {
        ...modelDiagnosis(),
        top_hypotheses: [
          {
            ...modelDiagnosis().top_hypotheses[0],
            component_code: "ALIEN_PART",
            confidence: 0.8
          }
        ]
      },
      runSafetyGate("xe kho de")
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.top_hypotheses[0]?.component_code).toBe("UNKNOWN");
    expect(result.diagnosis.top_hypotheses[0]?.confidence).toBeLessThan(0.8);
  });

  it("clamps confidence and caps compact arrays", () => {
    const extraHypothesis = { ...modelDiagnosis().top_hypotheses[0], rank: 2 as const };
    const result = postValidateDiagnosis(
      {
        ...modelDiagnosis(),
        overall_confidence: 1.7,
        top_hypotheses: [
          { ...modelDiagnosis().top_hypotheses[0], confidence: -1 },
          extraHypothesis,
          extraHypothesis
        ],
        recommended_next_actions: [
          { type: "book_mobile_repair", label: "Kiem tra" },
          { type: "safe_to_monitor", label: "Theo doi" },
          { type: "ask_followup", label: "Hoi them" }
        ],
        followup_questions: ["Cau 1?", "Cau 2?", "Cau 3?"],
        short_answer: "Mot. Hai. Ba. Bon."
      },
      runSafetyGate("xe kho de")
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.overall_confidence).toBe(1);
    expect(result.diagnosis.top_hypotheses).toHaveLength(2);
    expect(result.diagnosis.top_hypotheses[0]?.confidence).toBe(0);
    expect(result.diagnosis.recommended_next_actions).toHaveLength(2);
    expect(result.diagnosis.followup_questions).toHaveLength(2);
    expect(result.diagnosis.short_answer).toContain("Chua co uoc tinh chi phi");
    expect(sentenceCount(result.diagnosis.short_answer)).toBeLessThanOrEqual(3);
  });

  it("makes unavailable repair prices explicit", () => {
    const result = postValidateDiagnosis(modelDiagnosis(), runSafetyGate("xe kho de"));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.short_answer).toContain("Chua co uoc tinh chi phi");
  });

  it("normalizes minimal provider output into full diagnosis schema", () => {
    const result = postValidateDiagnosis(
      {
        v: 1,
        risk: "medium",
        ride: true,
        part: "SPARK_PLUG",
        issue: "May giat do bugi yeu hoac xang gio khong on dinh",
        answer: "Xe co the bi loi bugi hoac he thong nhien lieu.",
        actions: ["Kiem tra bugi va loc gio", "Mo ta them khi nao xe bi giat"],
        questions: ["Xe co kho de khong?"]
      },
      runSafetyGate("xe bi giat giat")
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.top_hypotheses[0]).toMatchObject({
      component_code: "SPARK_PLUG",
      cause: "May giat do bugi yeu hoac xang gio khong on dinh"
    });
    expect(result.diagnosis.recommended_next_actions).toHaveLength(2);
    expect(diagnosisSchema.safeParse(result.diagnosis).success).toBe(true);
  });

  it("reconciles AI part, ride, confidence, action, and cost with retrieved knowledge", () => {
    const result = postValidateDiagnosis(
      {
        v: 1,
        risk: "low",
        ride: false,
        part: "SPARK_PLUG",
        issue: "Xe co roi do pin yeu hoac sac kem",
        answer: "Xe co roi do pin yeu hoac sac kem. Hay kiem tra nhanh.",
        actions: ["Kiem tra bugi"],
        questions: []
      },
      runSafetyGate("xe co roi do pin yeu hoac sac kem va den yeu"),
      {
        retrievedKnowledge: retrieveKnowledge("xe co roi do pin yeu hoac sac kem va den yeu", 2)
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.risk_level).toBe("low");
    expect(result.diagnosis.can_continue_riding).toBe(true);
    expect(result.diagnosis.overall_confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.diagnosis.top_hypotheses[0]).toMatchObject({
      component_code: "BATTERY",
      estimated_cost_min: 0,
      estimated_cost_max: 0
    });
    expect(result.diagnosis.estimated_total).toMatchObject({
      min: 0,
      max: 0
    });
    expect(result.diagnosis.recommended_next_actions[0]?.type).toBe("book_mobile_repair");
    expect(diagnosisSchema.safeParse(result.diagnosis).success).toBe(true);
  });

  it("replaces UNKNOWN issue text with matched knowledge cause", () => {
    const result = postValidateDiagnosis(
      {
        v: 1,
        risk: "low",
        ride: true,
        part: "BATTERY",
        issue: "UNKNOWN",
        answer: "Xe co dau hieu pin yeu, nen kiem tra nhanh.",
        actions: ["Kiem tra binh va sac"],
        questions: []
      },
      runSafetyGate("den yeu va de yeu"),
      {
        retrievedKnowledge: retrieveKnowledge("den yeu va de yeu", 2)
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.top_hypotheses[0]?.component_code).toBe("BATTERY");
    expect(result.diagnosis.top_hypotheses[0]?.cause.toLowerCase()).not.toBe("unknown");
    expect(result.diagnosis.top_hypotheses[0]?.cause.length).toBeGreaterThan(8);
    expect(diagnosisSchema.safeParse(result.diagnosis).success).toBe(true);
  });

  it("uses vague-noise knowledge instead of displaying boolean-like model text", () => {
    const result = postValidateDiagnosis(
      {
        v: 1,
        risk: "medium",
        ride: true,
        part: "SPARK_PLUG",
        issue: "true",
        answer: "Xe co rui ro ve pin. Hay kiem tra ngay.",
        actions: ["Kiem tra binh"],
        questions: []
      },
      runSafetyGate("xe keu e e khi chay"),
      {
        retrievedKnowledge: retrieveKnowledge("xe keu e e khi chay", 2)
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.top_hypotheses[0]).toMatchObject({
      component_code: "UNKNOWN",
      cause: "Tiếng kêu chưa rõ vị trí",
      estimated_cost_min: 0,
      estimated_cost_max: 0
    });
    expect(result.diagnosis.top_hypotheses[0]?.cause).not.toBe("true");
    expect(result.diagnosis.overall_confidence).toBeLessThanOrEqual(0.55);
    expect(result.diagnosis.recommended_next_actions[0]?.type).toBe("ask_followup");
    expect(diagnosisSchema.safeParse(result.diagnosis).success).toBe(true);
  });

  it("forces dangerous safety override over low-risk model output", () => {
    const result = postValidateDiagnosis(
      {
        ...modelDiagnosis(),
        risk_level: "low",
        can_continue_riding: true,
        recommended_next_actions: [{ type: "safe_to_monitor", label: "Theo doi" }]
      },
      runSafetyGate("mat phanh")
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(["high", "critical"]).toContain(result.diagnosis.risk_level);
    expect(result.diagnosis.can_continue_riding).toBe(false);
    expect(result.diagnosis.recommended_next_actions[0]?.type).toBe("emergency_rescue");
    expect(result.diagnosis.short_answer).toContain("Dung xe");
  });

  it("uses curated questions when the model does not ask how to distinguish causes", () => {
    const result = postValidateDiagnosis(modelDiagnosis(), runSafetyGate("nhớt trắng sữa"), {
      retrievedKnowledge: retrieveKnowledge("nhớt trắng sữa")
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagnosis.followup_questions[0]).toContain("ngập nước");
    expect(result.diagnosis.estimated_total).toMatchObject({ min: 0, max: 0 });
  });
});

function modelDiagnosis() {
  return {
    short_answer: "Can kiem tra binh.",
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

function sentenceCount(value: string): number {
  return value
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}
