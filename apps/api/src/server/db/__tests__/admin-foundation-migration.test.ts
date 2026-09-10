import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "..",
  "..",
  "supabase",
  "migrations",
  "202606250015_admin_foundation.sql"
);
const migrationSql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("admin foundation migration", () => {
  it("adds bounded admin reasons and append-only internal notes", () => {
    expect(migrationSql).toContain("add column admin_reason text");
    expect(migrationSql).toContain("between 10 and 500");
    expect(migrationSql).toContain("create table admin_internal_notes");
    expect(migrationSql).toContain(
      "check (num_nonnulls(service_request_id, assignment_id) = 1)"
    );
    expect(migrationSql).toContain("length(btrim(note_text)) between 1 and 2000");
    expect(migrationSql).toContain("admin_internal_notes_reject_update_delete");
    expect(migrationSql).toContain("admin_internal_notes_reject_truncate");
  });

  it("enables RLS, revokes direct actors, and adds bounded query indexes", () => {
    expect(migrationSql).toContain(
      "alter table admin_internal_notes enable row level security"
    );
    expect(migrationSql).toContain("revoke all on admin_internal_notes from anon");
    expect(migrationSql).toContain(
      "revoke all on admin_internal_notes from authenticated"
    );
    expect(migrationSql).toContain("audit_logs_admin_activity_idx");
    expect(migrationSql).toContain("admin_internal_notes_request_created_idx");
    expect(migrationSql).toContain("admin_internal_notes_assignment_created_idx");
  });

  it("contains no deferred payment schema", () => {
    expect(migrationSql).not.toMatch(/\bcreate\s+(?:type|table)\s+payment_/);
    expect(migrationSql).not.toMatch(/\brefund(?:s|ed|_|\b)/);
  });
});
