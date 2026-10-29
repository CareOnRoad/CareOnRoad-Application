import { describe, expect, it } from "vitest";

import { knowledgeBase } from "../knowledge-base";
import { repairPrices } from "../repair-prices";
import { knowledgeReviewedAt, knowledgeSources } from "../knowledge-sources";

const officialHosts = {
  yamaha: "yamaha-motor.com.vn",
  honda: "www.honda.com.vn",
  suzuki: "mc.suzuki.com.ph",
  sym: "www.sym.com.vn",
  piaggio: "www.piaggio.com"
} as const;

describe("curated knowledge integrity", () => {
  it("requires traceable sources for active technical claims and keeps policies UNKNOWN", () => {
    expect(new Set(knowledgeBase.map((entry) => entry.entry_id)).size).toBe(knowledgeBase.length);
    for (const entry of knowledgeBase) {
      expect(entry.followup_questions.length).toBeGreaterThan(0);
      expect(entry.followup_questions.length).toBeLessThanOrEqual(2);
      if (entry.review_status === "pending") {
        expect(entry.reviewed_at).toBeNull();
        continue;
      }
      expect(entry.reviewed_at).toBe(knowledgeReviewedAt);
      if (entry.review_status === "internal_policy") {
        expect(entry.component_code).toBe("UNKNOWN");
        expect(entry.source_refs).toEqual([]);
      } else {
        expect(entry.source_refs.length).toBeGreaterThan(0);
        for (const ref of entry.source_refs) {
          expect(ref.section.length).toBeGreaterThan(0);
          const publisher = ref.source_id.split("-")[0] as keyof typeof officialHosts;
          const url = new URL(knowledgeSources[ref.source_id].url);
          expect(url.protocol).toBe("https:");
          expect(url.hostname).toBe(officialHosts[publisher]);
          if (entry.applicability) expect(publisher).toBe(entry.applicability.brand);
        }
      }
      if (["high", "critical"].includes(entry.risk_level)) {
        expect(entry.can_continue_riding).toBe(false);
      }
    }
  });

  it("records market/model boundaries without inventing model years from an upload URL", () => {
    for (const entry of knowledgeBase.filter((item) => item.applicability)) {
      expect(entry.applicability?.note.length).toBeGreaterThan(0);
      expect(entry.applicability?.model_years).toBeNull();
      if (entry.applicability?.market === "PH") {
        expect(entry.applicability.brand).toBe("suzuki");
        expect(entry.applicability.models.length).toBeGreaterThan(0);
        expect(entry.source_refs.map((ref) => ref.source_id)).toEqual(["suzuki-ph-raider-fi-manual"]);
      }
    }
    expect(knowledgeSources["suzuki-ph-raider-fi-manual"].published_at).toBeNull();
  });

  it("only shows prices that come from the sourced price catalog", () => {
    const catalogRanges = Object.values(repairPrices).map((price) => `${price.min}-${price.max}`);
    for (const price of Object.values(repairPrices)) {
      expect(price.min).toBeGreaterThan(0);
      expect(price.min).toBeLessThan(price.max);
      expect(price.sources.length).toBeGreaterThan(0);
      expect(price.sources.every((url) => url.startsWith("https://"))).toBe(true);
    }
    for (const entry of knowledgeBase) {
      const priced = entry.estimated_cost_max > 0;
      expect(entry.price_status).toBe(priced ? "dealer_reference" : "unavailable");
      if (priced) expect(catalogRanges).toContain(`${entry.estimated_cost_min}-${entry.estimated_cost_max}`);
      if (entry.component_code === "UNKNOWN" || entry.review_status === "internal_policy") expect(priced).toBe(false);
    }
  });
});
