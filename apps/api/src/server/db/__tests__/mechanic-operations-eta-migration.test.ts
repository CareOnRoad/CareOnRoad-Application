import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "..",
  "..",
  "supabase",
  "migrations",
  "202606250017_assignment_eta_metadata.sql"
);
const migrationSql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("mechanic operations ETA migration", () => {
  it("adds assignment ETA metadata with assignment and mechanic identity constraints", () => {
    expect(migrationSql).toContain("create table assignment_eta_metadata");
    expect(migrationSql).toContain("assignment_id uuid not null");
    expect(migrationSql).toContain("request_id uuid not null");
    expect(migrationSql).toContain("mechanic_id uuid not null");
    expect(migrationSql).toContain("eta_at timestamptz");
    expect(migrationSql).toContain("delay_reason text");
    expect(migrationSql).toContain("references assignments (id, request_id, mechanic_id)");
    expect(migrationSql).toContain("check (created_by = mechanic_id)");
    expect(migrationSql).toContain("check (eta_at is not null or delay_reason is not null)");
  });

  it("keeps metadata append-only, indexed, and backend-owned", () => {
    expect(migrationSql).toContain("assignment_eta_metadata_assignment_created_idx");
    expect(migrationSql).toContain("assignment_eta_metadata_mechanic_created_idx");
    expect(migrationSql).toContain(
      "alter table assignment_eta_metadata enable row level security"
    );
    expect(migrationSql).toContain("revoke all on assignment_eta_metadata from anon");
    expect(migrationSql).toContain(
      "revoke all on assignment_eta_metadata from authenticated"
    );
    expect(migrationSql).toContain("grant select on assignment_eta_metadata to authenticated");
  });

  it("does not introduce live tracking, maps, or payment schema", () => {
    expect(migrationSql).not.toMatch(/\b(latitude|longitude|location|gps|tracking|map)_/);
    expect(migrationSql).not.toMatch(/\bcreate\s+(?:type|table)\s+payment_/);
    expect(migrationSql).not.toMatch(/\brefund(?:s|ed|_|\b)/);
  });
});
