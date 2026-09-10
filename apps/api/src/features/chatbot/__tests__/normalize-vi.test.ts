import { describe, expect, it } from "vitest";

import { includesNormalizedPhrase, normalizeVietnameseText } from "../normalize-vi";

describe("normalizeVietnameseText", () => {
  it("lowercases, removes Vietnamese marks, and collapses spaces", () => {
    expect(normalizeVietnameseText("  Xe KHÓ ĐỀ, đèn yếu!  ")).toBe("xe kho de den yeu");
  });

  it("matches normalized Vietnamese phrases", () => {
    expect(includesNormalizedPhrase("Xe sáng nay khó đề quá", "khó đề")).toBe(true);
  });
});
