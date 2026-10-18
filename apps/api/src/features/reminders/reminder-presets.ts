import { vietnamMorningUtc, vietnamToday } from "@/lib/vietnam-date";

export const reminderItemCodes = [
  "engine_oil",
  "gear_oil",
  "brake_fluid",
  "coolant",
  "insurance_renewal"
] as const;
export type ReminderItemCode = (typeof reminderItemCodes)[number];

export const usageLevels = ["light", "normal", "heavy"] as const;
export type UsageLevel = (typeof usageLevels)[number];

export const KM_PER_DAY: Record<UsageLevel, number> = { light: 15, normal: 30, heavy: 100 };
export const UNKNOWN_LAST_DONE_DUE_DAYS = 7;
export const MAX_DONE_AGE_DAYS = 3650;

export type ReminderPreset = {
  itemCode: ReminderItemCode;
  title: string;
  requiredPlan: "advance" | "vip";
  basisKm?: number;
  maxDays: number;
  leadDays: number;
};

// Intervals follow manufacturer guidance (design spec sections 5.3 and 11.2); edit constants, no migration needed.
export const reminderPresets: readonly ReminderPreset[] = [
  {
    itemCode: "engine_oil",
    title:
      "Thay nhớt máy. Nhờ thợ kiểm tra luôn má phanh, lốp, ắc quy, bugi, lọc gió, dây curoa (xe ga) hoặc sên (xe số).",
    requiredPlan: "advance",
    basisKm: 3000,
    maxDays: 180,
    leadDays: 0
  },
  {
    itemCode: "gear_oil",
    title: "Thay nhớt láp (xe tay ga).",
    requiredPlan: "advance",
    basisKm: 10000,
    maxDays: 730,
    leadDays: 0
  },
  {
    itemCode: "brake_fluid",
    title: "Thay dầu phanh (xe phanh đĩa).",
    requiredPlan: "advance",
    maxDays: 730,
    leadDays: 0
  },
  {
    itemCode: "coolant",
    title: "Thay nước làm mát (xe có két nước).",
    requiredPlan: "advance",
    maxDays: 1095,
    leadDays: 0
  },
  {
    itemCode: "insurance_renewal",
    title: "Gia hạn bảo hiểm TNDS bắt buộc.",
    requiredPlan: "vip",
    maxDays: 365,
    leadDays: 14
  }
];

export function findPreset(code: ReminderItemCode): ReminderPreset {
  // Codes are validated by Zod upstream, so the preset always exists.
  return reminderPresets.find((preset) => preset.itemCode === code)!;
}

export function intervalDaysFor(preset: ReminderPreset, level: UsageLevel): number {
  if (!preset.basisKm) {
    return preset.maxDays;
  }
  const days = Math.min(preset.basisKm / KM_PER_DAY[level], preset.maxDays);
  return Math.max(30, Math.floor(days / 30) * 30);
}

export function computeNextDueAt(input: {
  lastDoneOn?: string;
  intervalDays: number;
  leadDays: number;
  now: Date;
}): Date {
  const today = vietnamToday(input.now);
  if (!input.lastDoneOn) {
    return vietnamMorningUtc(today, UNKNOWN_LAST_DONE_DUE_DAYS);
  }
  const due = vietnamMorningUtc(input.lastDoneOn, input.intervalDays - input.leadDays);
  return due.getTime() <= input.now.getTime() ? vietnamMorningUtc(today, 1) : due;
}

export function toPresetResponse(preset: ReminderPreset) {
  return {
    item_code: preset.itemCode,
    title: preset.title,
    required_plan: preset.requiredPlan,
    interval_days: {
      light: intervalDaysFor(preset, "light"),
      normal: intervalDaysFor(preset, "normal"),
      heavy: intervalDaysFor(preset, "heavy")
    },
    lead_days: preset.leadDays
  };
}
