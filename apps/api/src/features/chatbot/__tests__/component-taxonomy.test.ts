import { describe, expect, it } from "vitest";

import { componentTaxonomy, isComponentCode } from "../component-taxonomy";

describe("component taxonomy", () => {
  it("contains all required component codes", () => {
    expect(Object.keys(componentTaxonomy).sort()).toEqual(
      [
        "AIR_FILTER",
        "BATTERY",
        "BRAKE_SYSTEM",
        "DRIVE_BELT",
        "ELECTRICAL_SYSTEM",
        "ENGINE_OIL",
        "FUEL_SYSTEM",
        "SPARK_PLUG",
        "TIRE",
        "UNKNOWN"
      ].sort()
    );
  });

  it("recognizes valid component codes", () => {
    expect(isComponentCode("BRAKE_SYSTEM")).toBe(true);
    expect(isComponentCode("NOT_A_COMPONENT")).toBe(false);
  });
});
