import { describe, expect, it } from "vitest";

import { PLAN_PERIOD_DAYS } from "../plan";
import {
  getPlanCatalog,
  getPlanEntry,
  getPurchasablePlans,
  isPurchasablePlan,
  NON_REFUNDABLE_NOTICE,
  PLAN_CATALOG
} from "../plan-catalog";

describe("plan catalog", () => {
  it("exposes exactly three tiers with the agreed prices", () => {
    const catalog = getPlanCatalog();
    expect(catalog.map((entry) => entry.code)).toEqual(["free", "advance", "vip"]);
    expect(catalog.map((entry) => entry.price)).toEqual([0, 10000, 50000]);
    expect(catalog.every((entry) => entry.currency === "VND")).toBe(true);
  });

  it("uses a 30-day period for every tier and never offers a yearly plan", () => {
    expect(PLAN_PERIOD_DAYS).toBe(30);
    expect(getPlanCatalog().every((entry) => entry.periodDays === 30)).toBe(true);
    expect(PLAN_CATALOG.some((entry) => entry.periodDays === 365)).toBe(false);
  });

  it("marks only the paid tiers as purchasable", () => {
    expect(isPurchasablePlan("free")).toBe(false);
    expect(isPurchasablePlan("advance")).toBe(true);
    expect(isPurchasablePlan("vip")).toBe(true);
    expect(getPurchasablePlans().map((entry) => entry.code)).toEqual(["advance", "vip"]);
  });

  it("lists features for every tier and highlights the VIP-only ones", () => {
    const advance = getPlanEntry("advance")!;
    const vip = getPlanEntry("vip")!;
    expect(advance.features.length).toBeGreaterThan(0);
    expect(vip.features.length).toBeGreaterThan(0);
    expect(vip.features.some((feature) => feature.includes("bảo hiểm"))).toBe(true);
    expect(vip.features.some((feature) => feature.includes("số khung"))).toBe(true);
  });

  it("returns a copy so callers cannot mutate the catalog", () => {
    const first = getPlanCatalog();
    first[0]!.features.push("tampered");
    expect(getPlanCatalog()[0]!.features).not.toContain("tampered");
  });

  it("states the non-refundable terms in Vietnamese", () => {
    expect(NON_REFUNDABLE_NOTICE).toContain("không được hoàn tiền");
  });
});
