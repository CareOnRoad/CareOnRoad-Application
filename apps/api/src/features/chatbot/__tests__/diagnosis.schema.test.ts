import { describe, expect, it } from "vitest";

import { diagnosisSchema } from "../diagnosis.schema";

const validDiagnosis = {
  short_answer: "Gia chi la uoc tinh. Nen kiem tra som.",
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

describe("diagnosisSchema", () => {
  it("accepts a valid compact diagnosis", () => {
    expect(diagnosisSchema.safeParse(validDiagnosis).success).toBe(true);
  });

  it("rejects invalid confidence", () => {
    const result = diagnosisSchema.safeParse({
      ...validDiagnosis,
      overall_confidence: 1.2
    });

    expect(result.success).toBe(false);
  });

  it("rejects more than 2 hypotheses", () => {
    const hypothesis = validDiagnosis.top_hypotheses[0];
    const result = diagnosisSchema.safeParse({
      ...validDiagnosis,
      top_hypotheses: [
        hypothesis,
        { ...hypothesis, rank: 2 },
        { ...hypothesis, rank: 2 }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("rejects more than 2 follow-up questions", () => {
    const result = diagnosisSchema.safeParse({
      ...validDiagnosis,
      followup_questions: ["Cau 1?", "Cau 2?", "Cau 3?"]
    });

    expect(result.success).toBe(false);
  });

  it("rejects estimated totals where min is greater than max", () => {
    const result = diagnosisSchema.safeParse({
      ...validDiagnosis,
      estimated_total: {
        currency: "VND",
        min: 500000,
        max: 100000
      }
    });

    expect(result.success).toBe(false);
  });
});
