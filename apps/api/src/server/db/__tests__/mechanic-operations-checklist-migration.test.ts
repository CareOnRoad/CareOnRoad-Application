import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "..",
  "..",
  "supabase",
  "migrations",
  "202606250019_assignment_completion_checklists.sql"
);
const migrationSql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("mechanic operations completion checklist migration", () => {
  it("adds append-only checklist records with assignment and mechanic identity constraints", () => {
    expect(migrationSql).toContain("create table assignment_completion_checklists");
    expect(migrationSql).toContain("assignment_id uuid not null");
    expect(migrationSql).toContain("request_id uuid not null");
    expect(migrationSql).toContain("mechanic_id uuid not null");
    expect(migrationSql).toContain("revision integer not null");
    expect(migrationSql).toContain("work_summary text not null");
    expect(migrationSql).toContain("safety_checklist jsonb not null");
    expect(migrationSql).toContain("references assignments (id, request_id, mechanic_id)");
    expect(migrationSql).toContain("unique (assignment_id, revision)");
    expect(migrationSql).toContain("check (created_by = mechanic_id)");
  });

  it("bounds work summary, requires structured safety checks, and keeps backend-owned access", () => {
    expect(migrationSql).toContain("between 10 and 3000");
    for (const key of [
      "test_ride_completed",
      "tools_removed",
      "area_safe",
      "rider_briefed",
      "no_fluid_leak"
    ]) {
      expect(migrationSql).toContain(`safety_checklist ? '${key}'`);
    }
    expect(migrationSql).toContain("assignment_completion_checklists_assignment_revision_idx");
    expect(migrationSql).toContain(
      "alter table assignment_completion_checklists enable row level security"
    );
    expect(migrationSql).toContain("revoke all on assignment_completion_checklists from anon");
    expect(migrationSql).toContain(
      "revoke all on assignment_completion_checklists from authenticated"
    );
    expect(migrationSql).toContain(
      "grant select on assignment_completion_checklists to authenticated"
    );
  });

  it("does not introduce force-status, assignment completion bypass, or payment schema", () => {
    expect(migrationSql).not.toMatch(/\b(force_status|complete_assignment|next_status)\b/);
    expect(migrationSql).not.toMatch(/\bupdate\s+assignments\b/);
    expect(migrationSql).not.toMatch(/\bcreate\s+(?:type|table)\s+payment_/);
    expect(migrationSql).not.toMatch(/\brefund(?:s|ed|_|\b)/);
  });
});
