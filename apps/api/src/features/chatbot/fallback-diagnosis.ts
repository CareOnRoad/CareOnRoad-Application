import type { DiagnosisResult, RecommendedActionType, RiskLevel } from "./diagnosis.schema";
import { diagnosisSchema } from "./diagnosis.schema";
import type { KnowledgeEntry } from "./knowledge-base";
import { knowledgeReviewedAt } from "./knowledge-sources";
import { retrieveKnowledge } from "./retrieval";
import { runSafetyGate } from "./safety-gate";

export type FallbackDiagnosisOptions = {
  transcribedText?: string;
};

export function createFallbackDiagnosis(
  contentText: string,
  options: FallbackDiagnosisOptions = {}
): DiagnosisResult {
  const safety = runSafetyGate(contentText);
  const retrieved = retrieveKnowledge(contentText, 2);
  const entries: KnowledgeEntry[] = retrieved.length > 0 ? retrieved : [unknownEntry()];
  const hypotheses = entries.slice(0, 2).map((entry, index) => ({
    rank: index === 0 ? (1 as const) : (2 as const),
    component_code: entry.component_code,
    cause: entry.cause,
    symptoms: entry.symptoms,
    consequences: entry.consequences,
    confidence: entry.component_code === "UNKNOWN" ? 0.25 : Math.max(0.45, 0.68 - index * 0.12),
    estimated_cost_min: entry.estimated_cost_min,
    estimated_cost_max: entry.estimated_cost_max
  }));

  const riskLevel = safety.is_dangerous
    ? safety.risk_level ?? "high"
    : highestRisk(entries.map((entry) => entry.risk_level));
  const canContinueRiding = safety.is_dangerous
    ? false
    : entries.every((entry) => entry.can_continue_riding);
  const totalMin = Math.min(...hypotheses.map((hypothesis) => hypothesis.estimated_cost_min));
  const totalMax = Math.max(...hypotheses.map((hypothesis) => hypothesis.estimated_cost_max));

  const diagnosis: DiagnosisResult = {
    short_answer: buildShortAnswer(safety.is_dangerous, retrieved.length > 0),
    overall_confidence: entries[0].component_code === "UNKNOWN" ? 0.25 : 0.62,
    risk_level: riskLevel,
    can_continue_riding: canContinueRiding,
    top_hypotheses: hypotheses,
    estimated_total: {
      currency: "VND",
      min: totalMin,
      max: totalMax
    },
    recommended_next_actions: buildActions(
      safety.is_dangerous,
      entries.map((entry) => ({
        type: entry.recommended_action_type,
        label: entry.recommended_action_label
      }))
    ),
    followup_questions: entries[0].followup_questions.slice(0, 2),
    ...(options.transcribedText ? { transcribed_text: options.transcribedText } : {}),
    fallback_used: true
  };

  return diagnosisSchema.parse(diagnosis);
}

function unknownEntry(): KnowledgeEntry {
  return {
    entry_id: "unknown",
    review_status: "internal_policy",
    reviewed_at: knowledgeReviewedAt,
    source_refs: [],
    vehicle_scope: "all_motorcycles",
    price_status: "unverified",
    followup_questions: ["Bạn dùng mẫu xe nào và triệu chứng xảy ra khi nào?"],
    symptom_keywords: [],
    normalized_keywords: [],
    component_code: "UNKNOWN",
    cause: "Chưa đủ dữ liệu",
    symptoms: "Triệu chứng chưa rõ",
    consequences: "Cần kiểm tra thêm",
    risk_level: "medium",
    can_continue_riding: true,
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    recommended_action_type: "ask_followup",
    recommended_action_label: "Mô tả thêm triệu chứng"
  };
}

function highestRisk(values: RiskLevel[]): RiskLevel {
  const rank: Record<RiskLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  };

  return values.reduce<RiskLevel>(
    (highest, value) => (rank[value] > rank[highest] ? value : highest),
    "low"
  );
}

function buildActions(
  isDangerous: boolean,
  recommended: Array<{ type: RecommendedActionType; label: string }>
): DiagnosisResult["recommended_next_actions"] {
  const actions = isDangerous
    ? [{ type: "emergency_rescue" as const, label: "Dừng xe và gọi hỗ trợ" }, ...recommended]
    : recommended;

  const unique = new Map<RecommendedActionType, string>();
  for (const action of actions) {
    if (!unique.has(action.type)) {
      unique.set(action.type, action.label);
    }
  }

  return Array.from(unique.entries())
    .slice(0, 2)
    .map(([type, label]) => ({ type, label }));
}

function buildShortAnswer(isDangerous: boolean, hasKnowledge: boolean): string {
  if (isDangerous) {
    return "Dừng xe ngay và không tiếp tục chạy. Chưa có ước tính chi phí, cần thợ kiểm tra.";
  }

  if (!hasKnowledge) {
    return "Chưa đủ dữ liệu để xác định lỗi. Chưa có ước tính chi phí, cần mô tả thêm.";
  }

  return "Các khả năng bên dưới cần được kiểm tra trực tiếp. Chưa có ước tính chi phí sửa chữa.";
}
