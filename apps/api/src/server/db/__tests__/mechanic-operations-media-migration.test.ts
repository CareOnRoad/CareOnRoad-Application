import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "..",
  "..",
  "supabase",
  "migrations",
  "202606250018_assignment_media_metadata.sql"
);
const migrationSql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("mechanic operations media migration", () => {
  it("adds assignment media metadata with assignment and mechanic identity constraints", () => {
    expect(migrationSql).toContain("create table assignment_media_metadata");
    expect(migrationSql).toContain("assignment_id uuid not null");
    expect(migrationSql).toContain("request_id uuid not null");
    expect(migrationSql).toContain("mechanic_id uuid not null");
    expect(migrationSql).toContain("purpose text not null");
    expect(migrationSql).toContain("media_reference text not null");
    expect(migrationSql).toContain("content_type text not null");
    expect(migrationSql).toContain("size_bytes bigint not null");
    expect(migrationSql).toContain("references assignments (id, request_id, mechanic_id)");
    expect(migrationSql).toContain("check (created_by = mechanic_id)");
  });

  it("keeps media metadata bounded, indexed, and backend-owned", () => {
    expect(migrationSql).toContain("assignment_media_metadata_assignment_created_idx");
    expect(migrationSql).toContain("assignment_media_metadata_mechanic_created_idx");
    expect(migrationSql).toContain("unique (assignment_id, media_reference)");
    expect(migrationSql).toContain(
      "alter table assignment_media_metadata enable row level security"
    );
    expect(migrationSql).toContain("revoke all on assignment_media_metadata from anon");
    expect(migrationSql).toContain(
      "revoke all on assignment_media_metadata from authenticated"
    );
    expect(migrationSql).toContain("grant select on assignment_media_metadata to authenticated");
  });

  it("does not persist raw media, provider payloads, live tracking, or payment schema", () => {
    expect(migrationSql).not.toMatch(
      /\b(raw_media|provider_payload|media_bytes|raw_bytes|blob_data|buffer_data|file_data)\b/
    );
    expect(migrationSql).not.toMatch(/\bprovider_payload\b/);
    expect(migrationSql).not.toMatch(/\b(latitude|longitude|location|gps|tracking|map)_/);
    expect(migrationSql).not.toMatch(/\bcreate\s+(?:type|table)\s+payment_/);
    expect(migrationSql).not.toMatch(/\brefund(?:s|ed|_|\b)/);
  });
});
