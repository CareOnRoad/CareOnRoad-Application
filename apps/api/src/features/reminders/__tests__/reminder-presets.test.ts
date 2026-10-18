import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  computeNextDueAt,
  findPreset,
  intervalDaysFor,
  reminderItemCodes,
  reminderPresets,
  toPresetResponse,
  usageLevels
} from "../reminder-presets";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "..",
    "..",
    "supabase",
    "migrations",
    "202606250048_maintenance_presets_and_plans.sql"
  ),
  "utf8"
);

describe("reminder presets", () => {
  it("derives interval days from manufacturer km/time limits (spec 11.2)", () => {
    const table: Record<string, [number, number, number]> = {
      engine_oil: [180, 90, 30],
      gear_oil: [660, 330, 90],
      brake_fluid: [730, 730, 730],
      coolant: [1095, 1095, 1095],
      insurance_renewal: [365, 365, 365]
    };
    for (const code of reminderItemCodes) {
      const preset = findPreset(code);
      expect(usageLevels.map((level) => intervalDaysFor(preset, level))).toEqual(table[code]);
    }
  });

  it("uses the spec titles, plans and lead days", () => {
    expect(findPreset("engine_oil").title).toBe(
      "Thay nhớt máy. Nhờ thợ kiểm tra luôn má phanh, lốp, ắc quy, bugi, lọc gió, dây curoa (xe ga) hoặc sên (xe số)."
    );
    expect(findPreset("gear_oil").title).toBe("Thay nhớt láp (xe tay ga).");
    expect(findPreset("brake_fluid").title).toBe("Thay dầu phanh (xe phanh đĩa).");
    expect(findPreset("coolant").title).toBe("Thay nước làm mát (xe có két nước).");
    expect(findPreset("insurance_renewal")).toMatchObject({
      title: "Gia hạn bảo hiểm TNDS bắt buộc.",
      requiredPlan: "vip",
      leadDays: 14
    });
    expect(reminderPresets.filter((p) => p.requiredPlan === "advance")).toHaveLength(4);
    expect(reminderPresets.filter((p) => p.leadDays === 0)).toHaveLength(4);
  });

  it("keeps every title within 200 characters", () => {
    for (const preset of reminderPresets) {
      expect(preset.title.length).toBeLessThanOrEqual(200);
    }
  });

  it("only lists item codes that the migration allows", () => {
    for (const code of reminderItemCodes) {
      expect(migrationSql).toContain(code);
    }
  });

  it("maps a preset to its API response shape", () => {
    expect(toPresetResponse(findPreset("insurance_renewal"))).toEqual({
      item_code: "insurance_renewal",
      title: "Gia hạn bảo hiểm TNDS bắt buộc.",
      required_plan: "vip",
      interval_days: { light: 365, normal: 365, heavy: 365 },
      lead_days: 14
    });
  });
});

describe("computeNextDueAt", () => {
  const now = new Date("2026-10-18T03:00:00Z");

  it("adds the interval to the last service date at 09:00 Vietnam time", () => {
    expect(
      computeNextDueAt({ lastDoneOn: "2026-09-01", intervalDays: 90, leadDays: 0, now }).toISOString()
    ).toBe("2026-11-30T02:00:00.000Z");
  });

  it("schedules unknown last service a week from today", () => {
    expect(computeNextDueAt({ intervalDays: 90, leadDays: 0, now }).toISOString()).toBe(
      "2026-10-25T02:00:00.000Z"
    );
  });

  it("moves overdue reminders to tomorrow morning", () => {
    expect(
      computeNextDueAt({ lastDoneOn: "2026-01-01", intervalDays: 90, leadDays: 0, now }).toISOString()
    ).toBe("2026-10-19T02:00:00.000Z");
  });

  it("rolls overdue to tomorrow in Vietnam when UTC is still the previous day", () => {
    const lateUtc = new Date("2026-10-18T20:00:00Z"); // 2026-10-19 03:00 in Vietnam
    expect(
      computeNextDueAt({ lastDoneOn: "2026-01-01", intervalDays: 90, leadDays: 0, now: lateUtc }).toISOString()
    ).toBe("2026-10-20T02:00:00.000Z");
  });

  it("treats a due time equal to now as overdue", () => {
    const tie = new Date("2026-10-18T02:00:00Z");
    expect(
      computeNextDueAt({ lastDoneOn: "2026-07-20", intervalDays: 90, leadDays: 0, now: tie }).toISOString()
    ).toBe("2026-10-19T02:00:00.000Z");
  });

  it("subtracts the lead days", () => {
    expect(
      computeNextDueAt({ lastDoneOn: "2026-03-15", intervalDays: 365, leadDays: 14, now }).toISOString()
    ).toBe("2027-03-01T02:00:00.000Z");
  });
});
