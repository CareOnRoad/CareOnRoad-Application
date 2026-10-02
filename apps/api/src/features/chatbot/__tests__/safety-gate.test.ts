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
  "chết máy khi đang chạy",
  "đang chạy thì chết máy", "đang chạy bị chết máy", "đang chạy thì tắt máy",
  "đang chạy bị tắt máy", "tắt máy khi đang chạy", "xe chết máy giữa đường",
  "Xe đang chạy, thì chết máy!", "xe dang chay thi chet may"
];

const normalCases = ["khó đề", "đề không nổ", "hụp ga", "hao xăng", "xe yếu", "đèn yếu",
  "không chết máy", "đã tắt máy rồi", "không đề được khi đỗ",
  "không chết máy khi đang chạy", "chưa bị chết máy khi đang chạy",
  "không hề tắt máy khi đang chạy", "đang chạy thì không chết máy"];

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

  it.each(["Xe không chết máy khi đang chạy nhưng bị chảy xăng",
    "Xe không chết máy khi đang chạy, sau đó chết máy khi đang chạy",
    "Xe không phải không chết máy khi đang chạy"])("preserves affirmative danger in mixed context: %s", (input) => {
    expect(runSafetyGate(input)).toMatchObject({ is_dangerous: true, can_continue_riding: false });
  });
});
