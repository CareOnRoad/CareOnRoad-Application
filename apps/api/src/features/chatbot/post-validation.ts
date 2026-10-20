import { type ComponentCode, getComponentLabel, isComponentCode } from "./component-taxonomy";
import type { DiagnosisResult, RecommendedActionType, RiskLevel } from "./diagnosis.schema";
import { diagnosisSchema } from "./diagnosis.schema";
import { normalizeVietnameseText } from "./normalize-vi";
import { defaultPriceByComponent, estimateTotal, priceRange } from "./repair-prices";
import type { RetrievedKnowledgeEntry } from "./retrieval";
import type { SafetyGateResult } from "./safety-gate";

export type PostValidationResult =
  | {
      success: true;
      diagnosis: DiagnosisResult;
    }
  | {
      success: false;
      reason: "UNREPAIRABLE_OUTPUT";
    };

const actionTypes = new Set<RecommendedActionType>([
  "emergency_rescue",
  "book_mobile_repair",
  "ask_followup",
  "safe_to_monitor"
]);

export function postValidateDiagnosis(
  modelOutput: unknown,
  safety: SafetyGateResult,
  options: { transcribedText?: string; retrievedKnowledge?: RetrievedKnowledgeEntry[] } = {}
): PostValidationResult {
  if (!modelOutput || typeof modelOutput !== "object" || Array.isArray(modelOutput)) {
    return { success: false, reason: "UNREPAIRABLE_OUTPUT" };
  }

  const raw = modelOutput as Record<string, unknown>;
  const primaryKnowledge = options.retrievedKnowledge?.[0];
  const needsClarification = primaryKnowledge?.review_status === "internal_policy"
    && primaryKnowledge.component_code === "UNKNOWN";
  if (!hasDiagnosticSubstance(raw, primaryKnowledge)) {
    return { success: false, reason: "UNREPAIRABLE_OUTPUT" };
  }

  const riskLevel = repairRiskLevel(firstDefined(raw.risk_level, raw.risk), safety, options.retrievedKnowledge);
  const canContinueRiding = repairCanContinueRiding(
    firstDefined(raw.can_continue_riding, raw.ride),
    riskLevel,
    safety,
    primaryKnowledge
  );
  const topHypotheses = repairHypotheses(raw.top_hypotheses, raw, options.retrievedKnowledge ?? []);
  const estimatedTotal = estimateTotal(topHypotheses);
  const overallConfidence = repairOverallConfidence(raw.overall_confidence, topHypotheses, primaryKnowledge);
  const repaired = {
    short_answer: repairShortAnswer(repairShortAnswerSeed(raw, primaryKnowledge), estimatedTotal.max > 0),
    overall_confidence: needsClarification ? Math.min(overallConfidence, 0.35) : overallConfidence,
    risk_level: riskLevel,
    can_continue_riding: canContinueRiding,
    top_hypotheses: topHypotheses,
    // Prices come only from the backend catalog; provider numbers are ignored.
    estimated_total: estimatedTotal,
    recommended_next_actions: needsClarification
      ? repairActions(undefined, {}, riskLevel, safety, primaryKnowledge)
      : repairActions(raw.recommended_next_actions, raw, riskLevel, safety, primaryKnowledge),
    followup_questions: needsClarification
      ? primaryKnowledge.followup_questions.slice(0, 2)
      : repairFollowupQuestions(firstDefined(raw.followup_questions, raw.questions), primaryKnowledge),
    ...(options.transcribedText ? { transcribed_text: options.transcribedText } : {}),
    fallback_used: Boolean(raw.fallback_used)
  };

  const safetyAdjusted = applySafetyOverride(repaired, safety);
  const parsed = diagnosisSchema.safeParse(safetyAdjusted);

  if (!parsed.success) {
    return { success: false, reason: "UNREPAIRABLE_OUTPUT" };
  }

  return {
    success: true,
    diagnosis: parsed.data
  };
}

function repairHypotheses(
  value: unknown,
  raw: Record<string, unknown>,
  retrievedKnowledge: RetrievedKnowledgeEntry[]
): DiagnosisResult["top_hypotheses"] {
  const primaryKnowledge = retrievedKnowledge[0];
  // A request to identify the vehicle cannot be turned into a technical diagnosis.
  if (primaryKnowledge?.review_status === "internal_policy" && primaryKnowledge.component_code === "UNKNOWN") {
    return [{
      rank: 1,
      component_code: "UNKNOWN",
      cause: primaryKnowledge.cause,
      symptoms: primaryKnowledge.symptoms,
      consequences: primaryKnowledge.consequences,
      confidence: 0.25,
      estimated_cost_min: 0,
      estimated_cost_max: 0
    }];
  }

  if (!Array.isArray(value)) {
    const shortIssue = firstMeaningfulString(raw.likely_issue, raw.issue).trim() || primaryKnowledge?.cause || "";
    if (!shortIssue) {
      return [];
    }

    const modelParts = [
      ...new Set((Array.isArray(raw.parts) ? raw.parts : [raw.likely_component_code, raw.part]).filter(isComponentCode))
    ];
    const firstCode = primaryKnowledge?.component_code ?? modelParts[0] ?? "UNKNOWN";
    const confidence = clampNumber(raw.overall_confidence) || 0.45;
    const first = {
      rank: 1 as const,
      component_code: firstCode,
      cause: shortIssue,
      symptoms: asMeaningfulString(raw.symptoms, primaryKnowledge?.symptoms ?? shortIssue),
      consequences: asMeaningfulString(raw.consequences, primaryKnowledge?.consequences ?? "Cần kiểm tra thêm"),
      confidence,
      ...costFor(firstCode, retrievedKnowledge)
    };
    const secondCode = [...modelParts, ...retrievedKnowledge.map((entry) => entry.component_code)]
      .find((code) => code !== firstCode && code !== "UNKNOWN");
    if (!secondCode) {
      return [first];
    }

    const secondKnowledge = retrievedKnowledge.find((entry) => entry.component_code === secondCode);
    return [
      first,
      {
        rank: 2,
        component_code: secondCode,
        cause: secondKnowledge?.cause ?? `Có thể liên quan ${getComponentLabel(secondCode).toLowerCase()}`,
        symptoms: secondKnowledge?.symptoms ?? first.symptoms,
        consequences: secondKnowledge?.consequences ?? "Cần thợ kiểm tra để xác nhận",
        confidence: Math.min(confidence, 0.35),
        ...costFor(secondCode, retrievedKnowledge)
      }
    ];
  }

  const repaired = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .slice(0, 2)
    .map((item, index) => {
      const componentCode = index === 0 && primaryKnowledge ? primaryKnowledge.component_code : asString(item.component_code);
      const validComponentCode = isComponentCode(componentCode);
      const code: ComponentCode = validComponentCode ? componentCode : "UNKNOWN";
      const confidence = clampNumber(item.confidence);

      return {
        rank: index === 0 ? (1 as const) : (2 as const),
        component_code: code,
        cause: asMeaningfulString(item.cause, primaryKnowledge?.cause ?? "Chưa xác định"),
        symptoms: asMeaningfulString(item.symptoms, primaryKnowledge?.symptoms ?? "Triệu chứng chưa rõ"),
        consequences: asMeaningfulString(item.consequences, primaryKnowledge?.consequences ?? "Cần kiểm tra thêm"),
        confidence: validComponentCode ? confidence : Math.min(confidence, 0.35),
        ...costFor(code, retrievedKnowledge)
      };
    });

  return repaired;
}

// A retrieved entry decides the price for its component (null-priced entries stay unpriced).
function costFor(code: ComponentCode, retrievedKnowledge: RetrievedKnowledgeEntry[]) {
  const entry = retrievedKnowledge.find((item) => item.component_code === code);
  const range = entry
    ? { min: entry.estimated_cost_min, max: entry.estimated_cost_max }
    : priceRange(defaultPriceByComponent[code]);
  return { estimated_cost_min: range.min, estimated_cost_max: range.max };
}

function repairActions(
  value: unknown,
  raw: Record<string, unknown>,
  riskLevel: RiskLevel,
  safety: SafetyGateResult,
  primaryKnowledge?: RetrievedKnowledgeEntry
): DiagnosisResult["recommended_next_actions"] {
  const unique = new Map<RecommendedActionType, string>();
  const add = (type: RecommendedActionType, label: string) => {
    if (!unique.has(type)) {
      unique.set(type, label);
    }
  };

  if (primaryKnowledge) {
    add(primaryKnowledge.recommended_action_type, primaryKnowledge.recommended_action_label);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }

      const action = item as Record<string, unknown>;
      const type = asString(action.type);
      if (!actionTypes.has(type as RecommendedActionType)) {
        continue;
      }

      add(type as RecommendedActionType, asNonEmptyString(action.label, "Kiểm tra thêm"));
    }
  }

  const simpleActions = firstDefined(raw.recommended_actions, raw.actions);
  if (Array.isArray(simpleActions)) {
    for (const label of simpleActions.map((item) => asString(item).trim()).filter(Boolean)) {
      add(inferActionType(label, riskLevel, safety), label);
    }
  }

  return Array.from(unique.entries())
    .slice(0, 2)
    .map(([type, label]) => ({ type, label }));
}

function repairFollowupQuestions(value: unknown, primaryKnowledge?: RetrievedKnowledgeEntry): string[] {
  const questions = (Array.isArray(value) ? value : [])
    .map((item) => asString(item).trim())
    .filter(Boolean)
    .slice(0, 2);

  return questions.length > 0 ? questions : primaryKnowledge?.followup_questions.slice(0, 2) ?? [];
}

export const priceNote = "Chi phí bên dưới chỉ là ước tính tham khảo, thợ sẽ báo giá chính xác.";
export const noPriceNote = "Chưa có ước tính chi phí, cần thợ kiểm tra.";

function repairShortAnswer(value: string, hasPrice: boolean): string {
  const sentences = splitSentences(value).slice(0, 2);
  return [...(sentences.length > 0 ? sentences : ["Cần kiểm tra thêm."]), hasPrice ? priceNote : noPriceNote].join(" ");
}

function applySafetyOverride(value: Record<string, unknown>, safety: SafetyGateResult): Record<string, unknown> {
  if (!safety.is_dangerous) {
    return value;
  }

  const riskLevel = repairRiskLevel(value.risk_level, safety);
  const actions = repairActions(value.recommended_next_actions, value, riskLevel, safety);
  const withoutEmergency = actions.filter((action) => action.type !== "emergency_rescue");

  return {
    ...value,
    short_answer: `Dừng xe ngay và gọi hỗ trợ. ${(value.estimated_total as { max: number }).max > 0 ? priceNote : noPriceNote}`,
    risk_level: safety.risk_level ?? "high",
    can_continue_riding: false,
    recommended_next_actions: [
      {
        type: "emergency_rescue",
        label: "Dừng xe và gọi hỗ trợ"
      },
      ...withoutEmergency
    ].slice(0, 2)
  };
}

function clampNumber(value: unknown): number {
  return Math.max(0, Math.min(1, asFiniteNumber(value)));
}

function hasDiagnosticSubstance(raw: Record<string, unknown>, primaryKnowledge?: RetrievedKnowledgeEntry): boolean {
  return (
    firstMeaningfulString(raw.likely_issue, raw.issue).trim().length > 0 ||
    Array.isArray(raw.top_hypotheses) ||
    Boolean(primaryKnowledge && firstMeaningfulString(raw.short_answer, raw.answer).trim())
  );
}

function repairShortAnswerSeed(raw: Record<string, unknown>, primaryKnowledge?: RetrievedKnowledgeEntry): string {
  if (primaryKnowledge?.component_code === "UNKNOWN") {
    return primaryKnowledge.cause;
  }

  return firstMeaningfulString(raw.short_answer, raw.answer) || primaryKnowledge?.cause || "";
}

function repairRiskLevel(value: unknown, safety: SafetyGateResult, retrievedKnowledge?: RetrievedKnowledgeEntry[]): RiskLevel {
  if (safety.risk_level) {
    return safety.risk_level;
  }

  if (retrievedKnowledge?.length) {
    return highestRisk(retrievedKnowledge.map((entry) => entry.risk_level));
  }

  const raw = asString(value);
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "critical") {
    return raw;
  }

  return "medium";
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

function repairCanContinueRiding(
  value: unknown,
  riskLevel: RiskLevel,
  safety: SafetyGateResult,
  primaryKnowledge?: RetrievedKnowledgeEntry
): boolean {
  if (typeof safety.can_continue_riding === "boolean") {
    return safety.can_continue_riding;
  }

  if (primaryKnowledge && primaryKnowledge.risk_level === riskLevel) {
    return primaryKnowledge.can_continue_riding;
  }

  if (riskLevel === "high" || riskLevel === "critical") {
    return false;
  }

  if (riskLevel === "low") {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return true;
}

function repairOverallConfidence(
  value: unknown,
  hypotheses: DiagnosisResult["top_hypotheses"],
  primaryKnowledge?: RetrievedKnowledgeEntry
): number {
  const explicit = clampNumber(value);
  if (explicit > 0) {
    return explicit;
  }

  const primaryHypothesis = hypotheses[0];
  if (primaryKnowledge && primaryHypothesis?.component_code === primaryKnowledge.component_code) {
    if (primaryKnowledge.component_code === "UNKNOWN") {
      return 0.4;
    }

    return 0.6;
  }

  if (primaryHypothesis && primaryHypothesis.component_code !== "UNKNOWN") {
    return 0.55;
  }

  return 0.4;
}

function inferActionType(label: string, riskLevel: RiskLevel, safety: SafetyGateResult): RecommendedActionType {
  const normalized = normalizeVietnameseText(label);
  if (safety.is_dangerous || riskLevel === "critical" || normalized.includes("dung xe") || normalized.includes("cuu ho")) {
    return "emergency_rescue";
  }

  if (normalized.includes("hoi") || normalized.includes("mo ta") || normalized.includes("them")) {
    return "ask_followup";
  }

  if (normalized.includes("theo doi")) {
    return "safe_to_monitor";
  }

  return "book_mobile_repair";
}

function asFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined);
}

function firstMeaningfulString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && isMeaningfulDiagnosticText(value)) {
      return value;
    }
  }

  return "";
}

function asNonEmptyString(value: unknown, fallback: string): string {
  const text = asString(value).trim();
  return text || fallback;
}

function asMeaningfulString(value: unknown, fallback: string): string {
  const text = asString(value).trim();
  return isMeaningfulDiagnosticText(text) ? text : fallback;
}

function isMeaningfulDiagnosticText(value: string): boolean {
  const text = value.trim();
  if (text.length < 4) {
    return false;
  }

  const normalized = normalizeVietnameseText(text);
  return !new Set([
    "true",
    "false",
    "null",
    "undefined",
    "yes",
    "no",
    "n/a",
    "na",
    "none",
    "unknown",
    "chua xac dinh",
    "chua ro",
    "khong ro",
    "khong xac dinh"
  ]).has(normalized);
}

function splitSentences(value: string): string[] {
  const matches = value.match(/[^.!?]+[.!?]?/g) ?? [];
  return matches
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`));
}
