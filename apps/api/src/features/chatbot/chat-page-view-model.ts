import { getComponentLabel } from "./component-taxonomy";
import type { DiagnosisResult, Hypothesis, RiskLevel } from "./diagnosis.schema";

export const advisoryDisclaimer =
  "Kết quả chỉ mang tính tham khảo, không phải báo giá cuối cùng.";

export type DiagnosisViewModel = {
  summary: string;
  confidence: string;
  riskLabel: string;
  riskTone: "low" | "medium" | "high" | "critical";
  canContinueText: string;
  estimatedTotal: string;
  hypotheses: Array<{
    rank: 1 | 2;
    componentLabel: string;
    cause: string;
    symptoms: string;
    consequences: string;
    confidence: string;
    estimatedCost: string;
  }>;
  recommendedAction: string;
  fallbackUsed: boolean;
  transcribedText?: string;
};

const riskLabels: Record<RiskLevel, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  critical: "Khẩn cấp"
};

export function toDiagnosisViewModel(diagnosis: DiagnosisResult): DiagnosisViewModel {
  return {
    summary: diagnosis.short_answer,
    confidence: formatPercent(diagnosis.overall_confidence),
    riskLabel: riskLabels[diagnosis.risk_level],
    riskTone: diagnosis.risk_level,
    canContinueText: continueText(diagnosis),
    estimatedTotal: formatVndRange(diagnosis.estimated_total.min, diagnosis.estimated_total.max),
    hypotheses: diagnosis.top_hypotheses.slice(0, 2).map(toHypothesisViewModel),
    recommendedAction: diagnosis.recommended_next_actions[0]?.label ?? "Theo dõi thêm",
    fallbackUsed: diagnosis.fallback_used,
    ...(diagnosis.transcribed_text ? { transcribedText: diagnosis.transcribed_text } : {})
  };
}

export function formatVndRange(min: number, max: number): string {
  if (min === 0 && max === 0) {
    return "Chưa ước tính";
  }

  const formatter = new Intl.NumberFormat("vi-VN");
  return `${formatter.format(min)} - ${formatter.format(max)} VND`;
}

function toHypothesisViewModel(hypothesis: Hypothesis): DiagnosisViewModel["hypotheses"][number] {
  return {
    rank: hypothesis.rank,
    componentLabel: getComponentLabel(hypothesis.component_code),
    cause: hypothesis.cause,
    symptoms: hypothesis.symptoms,
    consequences: hypothesis.consequences,
    confidence: formatPercent(hypothesis.confidence),
    estimatedCost: formatVndRange(hypothesis.estimated_cost_min, hypothesis.estimated_cost_max)
  };
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function continueText(diagnosis: DiagnosisResult): string {
  if (diagnosis.can_continue_riding) {
    return diagnosis.risk_level === "low" ? "Có thể đi thận trọng" : "Chạy chậm và theo dõi";
  }

  if (diagnosis.risk_level === "high" || diagnosis.risk_level === "critical") {
    return "Dừng xe ngay";
  }

  return "Nên hạn chế chạy tiếp";
}
