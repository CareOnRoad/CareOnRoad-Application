const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string): [number, number, number] {
  const [year, month, day] = value.split("-").map(Number);
  return [year, month, day];
}

/** `YYYY-MM-DD` for the current day in Vietnam (UTC+7). */
export function vietnamToday(now: Date): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** True for `YYYY-MM-DD` strings that are real calendar dates. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = parseIsoDate(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value;
}

/** 09:00 Vietnam time (02:00Z) on `date` plus `offsetDays`. */
export function vietnamMorningUtc(date: string, offsetDays = 0): Date {
  const [year, month, day] = parseIsoDate(date);
  return new Date(Date.UTC(year, month - 1, day + offsetDays, 2, 0, 0));
}

/** Valid date that is not after Vietnam today and not older than `maxAgeDays`. */
export function isPastOrTodayVietnam(date: string, now: Date, maxAgeDays: number): boolean {
  if (!isIsoDate(date)) {
    return false;
  }
  const today = vietnamToday(now);
  const oldest = new Date(vietnamMorningUtc(today).getTime() - maxAgeDays * DAY_MS)
    .toISOString()
    .slice(0, 10);
  // ISO dates compare correctly as strings.
  return date <= today && date >= oldest;
}

/** Maps a postgres `date` value (Date at UTC midnight or string) to `YYYY-MM-DD`. */
export function dateOnly(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}
