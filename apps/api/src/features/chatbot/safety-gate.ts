import type { RecommendedActionType, RiskLevel } from "./diagnosis.schema";
import { normalizeVietnameseText } from "./normalize-vi";

export type DangerousSymptomCode =
  | "BRAKE_FAILURE"
  | "FUEL_LEAK"
  | "SMOKE"
  | "BURNING_SMELL"
  | "UNSTABLE_STEERING"
  | "ENGINE_SHUTDOWN_WHILE_RIDING";

export type SafetyMatch = {
  code: DangerousSymptomCode;
  keyword: string;
  normalized_keyword: string;
};

export type SafetyGateResult = {
  is_dangerous: boolean;
  risk_level: Extract<RiskLevel, "high" | "critical"> | null;
  can_continue_riding: boolean | null;
  recommended_action_type: RecommendedActionType | null;
  matches: SafetyMatch[];
};

type DangerousPattern = {
  code: DangerousSymptomCode;
  riskLevel: Extract<RiskLevel, "high" | "critical">;
  keywords: string[];
};

const dangerousPatterns: DangerousPattern[] = [
  {
    code: "BRAKE_FAILURE",
    riskLevel: "critical",
    keywords: ["mất phanh", "thắng không ăn", "bó thắng"]
  },
  {
    code: "FUEL_LEAK",
    riskLevel: "critical",
    keywords: ["chảy xăng", "rò xăng", "mùi xăng nồng"]
  },
  {
    code: "SMOKE",
    riskLevel: "critical",
    keywords: ["bốc khói", "khói trắng nhiều", "khói đen nhiều"]
  },
  {
    code: "BURNING_SMELL",
    riskLevel: "critical",
    keywords: ["mùi cháy", "khét"]
  },
  {
    code: "UNSTABLE_STEERING",
    riskLevel: "critical",
    keywords: ["rung lắc tay lái", "đảo tay lái"]
  },
  {
    code: "ENGINE_SHUTDOWN_WHILE_RIDING",
    riskLevel: "high",
    keywords: ["xe tắt máy giữa đường", "chết máy khi đang chạy"]
  }
];

export function runSafetyGate(input: string): SafetyGateResult {
  const normalizedInput = ` ${normalizeVietnameseText(input)} `;
  const matches = dangerousPatterns.flatMap((pattern) =>
    pattern.keywords
      .map((keyword) => ({
        keyword,
        normalizedKeyword: normalizeVietnameseText(keyword)
      }))
      .filter(({ normalizedKeyword }) => normalizedInput.includes(` ${normalizedKeyword} `))
      .map(({ keyword, normalizedKeyword }) => ({
        code: pattern.code,
        keyword,
        normalized_keyword: normalizedKeyword
      }))
  );

  if (matches.length === 0) {
    return {
      is_dangerous: false,
      risk_level: null,
      can_continue_riding: null,
      recommended_action_type: null,
      matches: []
    };
  }

  const riskLevel = matches.some(
    (match) => dangerousPatterns.find((pattern) => pattern.code === match.code)?.riskLevel === "critical"
  )
    ? "critical"
    : "high";

  return {
    is_dangerous: true,
    risk_level: riskLevel,
    can_continue_riding: false,
    recommended_action_type: "emergency_rescue",
    matches
  };
}
