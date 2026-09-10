import { describe, expect, it } from "vitest";

import { runSafetyGate } from "../safety-gate";

const dangerousCases = [
  "mất phanh",
  "thắng không ăn",
  "bó thắng",
  "chảy xăng",
  "rò xăng",
  "mùi xăng nồng",
  "bốc khói",
  "khói trắng nhiều",
  "khói đen nhiều",
  "mùi cháy",
  "khét",
  "rung lắc tay lái",
  "đảo tay lái",
  "xe tắt máy giữa đường",
  "chết máy khi đang chạy"
];

const normalCases = ["khó đề", "đề không nổ", "hụp ga", "hao xăng", "xe yếu", "đèn yếu"];

describe("runSafetyGate", () => {
  it.each(dangerousCases)("detects dangerous symptom: %s", (input) => {
    const result = runSafetyGate(`Xe bị ${input}`);

    expect(result.is_dangerous).toBe(true);
    expect(["high", "critical"]).toContain(result.risk_level);
    expect(result.can_continue_riding).toBe(false);
    expect(result.recommended_action_type).toBe("emergency_rescue");
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it.each(normalCases)("does not trigger emergency for normal symptom: %s", (input) => {
    const result = runSafetyGate(`Xe bị ${input}`);

    expect(result.is_dangerous).toBe(false);
    expect(result.recommended_action_type).toBeNull();
  });
});
