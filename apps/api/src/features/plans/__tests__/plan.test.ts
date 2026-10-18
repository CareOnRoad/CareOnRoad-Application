import { describe, expect, it } from "vitest";

import { effectivePlan, hasPlan, nextPlanExpiry, planRequiredDetails } from "../plan";

const now = new Date("2026-10-18T03:00:00Z");
const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

describe("effectivePlan", () => {
  it("treats a holder without a plan as free", () => {
    expect(effectivePlan({}, now)).toBe("free");
  });

  it("returns the plan while it expires strictly after now", () => {
    expect(
      effectivePlan({ planCode: "advance", planExpiresAt: new Date(now.getTime() + 1) }, now)
    ).toBe("advance");
  });

  it("falls back to free when the plan expires exactly now", () => {
    expect(effectivePlan({ planCode: "vip", planExpiresAt: now }, now)).toBe("free");
  });

  it("falls back to free when the plan has no expiry or is past", () => {
    expect(effectivePlan({ planCode: "vip" }, now)).toBe("free");
    expect(effectivePlan({ planCode: "vip", planExpiresAt: past }, now)).toBe("free");
  });
});

describe("hasPlan", () => {
  it("ranks free < advance < vip", () => {
    expect(hasPlan({ planCode: "vip", planExpiresAt: future }, "advance", now)).toBe(true);
    expect(hasPlan({ planCode: "advance", planExpiresAt: future }, "vip", now)).toBe(false);
    expect(hasPlan({}, "free", now)).toBe(true);
    expect(hasPlan({ planCode: "vip", planExpiresAt: past }, "advance", now)).toBe(false);
  });
});

describe("nextPlanExpiry", () => {
  it("extends from the current expiry when renewing the same active plan", () => {
    expect(
      nextPlanExpiry(
        { planCode: "advance", planExpiresAt: new Date("2026-11-01T00:00:00Z") },
        "advance",
        "month",
        now
      ).toISOString()
    ).toBe("2026-12-01T00:00:00.000Z");
  });

  it("starts from now when switching to a different plan", () => {
    expect(
      nextPlanExpiry({ planCode: "advance", planExpiresAt: future }, "vip", "year", now).toISOString()
    ).toBe("2027-10-18T03:00:00.000Z");
  });

  it("starts from now when the plan already expired", () => {
    expect(
      nextPlanExpiry(
        { planCode: "advance", planExpiresAt: past },
        "advance",
        "month",
        now
      ).toISOString()
    ).toBe("2026-11-17T03:00:00.000Z");
  });
});

describe("planRequiredDetails", () => {
  it("describes the missing plan", () => {
    expect(planRequiredDetails("vip")).toEqual({ reason: "plan_required", required_plan: "vip" });
  });
});
