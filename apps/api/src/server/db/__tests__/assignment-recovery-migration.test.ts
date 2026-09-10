import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/202606250027_assignment_recovery.sql"),
  "utf8"
).toLowerCase();

describe("assignment recovery migration", () => {
  it("adds a distinct terminal status with timestamp constraint and lookup index", () => {
    expect(sql).toContain("alter type assignment_status add value if not exists 'recovery_canceled'");
    expect(sql).toContain("assignments_recovery_canceled_timestamp_check");
    expect(sql).toContain("assignments_recovery_canceled_idx");
    expect(sql).not.toContain("drop table");
  });
});
