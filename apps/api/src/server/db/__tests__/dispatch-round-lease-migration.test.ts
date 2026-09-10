import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/202606250021_dispatch_round_leases.sql"),
  "utf8"
).toLowerCase();

describe("dispatch round lease migration", () => {
  it("adds recoverable backend worker lease metadata", () => {
    expect(migrationSql).toContain("add column if not exists lease_owner text");
    expect(migrationSql).toContain("add column if not exists lease_expires_at timestamptz");
    expect(migrationSql).toContain("add column if not exists failure_count integer not null default 0");
    expect(migrationSql).toContain("dispatch_rounds_due_claim_idx");
    expect(migrationSql).toContain("where status = 'active'");
  });

  it("does not grant clients mutation access", () => {
    expect(migrationSql).not.toMatch(/grant\s+(insert|update|delete|all)/);
  });
});
