import { describe, expect, it } from "vitest";

import {
  dateOnly,
  isIsoDate,
  isPastOrTodayVietnam,
  vietnamMorningUtc,
  vietnamToday
} from "../vietnam-date";

describe("vietnam-date", () => {
  it("computes today in Vietnam time", () => {
    expect(vietnamToday(new Date("2026-10-18T16:59:59Z"))).toBe("2026-10-18");
    expect(vietnamToday(new Date("2026-10-18T17:00:00Z"))).toBe("2026-10-19");
  });

  it("validates real ISO dates only", () => {
    expect(isIsoDate("2026-10-18")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate("not-a-date")).toBe(false);
    expect(isIsoDate("2026-09-01T00:00:00Z")).toBe(false);
  });

  it("returns 09:00 Vietnam time (02:00Z) with day offsets", () => {
    expect(vietnamMorningUtc("2026-10-18").toISOString()).toBe("2026-10-18T02:00:00.000Z");
    expect(vietnamMorningUtc("2026-10-30", 3).toISOString()).toBe("2026-11-02T02:00:00.000Z");
  });

  it("accepts past or Vietnam-today dates within the max age", () => {
    const now = new Date("2026-10-18T18:00:00Z"); // 2026-10-19 in Vietnam
    expect(isPastOrTodayVietnam("2026-10-19", now, 3650)).toBe(true);
    expect(isPastOrTodayVietnam("2026-10-20", now, 3650)).toBe(false);
    expect(isPastOrTodayVietnam("2010-01-01", now, 3650)).toBe(false);
    expect(isPastOrTodayVietnam("2026-02-30", now, 3650)).toBe(false);
  });

  it("includes exactly maxAgeDays back from Vietnam today", () => {
    const now = new Date("2026-10-18T03:00:00Z"); // 2026-10-18 in Vietnam
    expect(isPastOrTodayVietnam("2016-10-20", now, 3650)).toBe(true); // today - 3650 days
    expect(isPastOrTodayVietnam("2016-10-19", now, 3650)).toBe(false); // today - 3651 days
  });

  it("maps date columns to YYYY-MM-DD from string or Date", () => {
    expect(dateOnly("2026-09-01")).toBe("2026-09-01");
    expect(dateOnly(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09-01");
  });
});
