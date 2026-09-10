import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "..", "..", "supabase", "migrations");
const expectedFoundationMigrations = [
  "202606250001_enable_extensions.sql",
  "202606250002_outbox_audit_idempotency.sql",
  "202606250003_rls_foundation.sql"
];

describe("foundation migrations", () => {
  it("uses the expected ordered migration names", () => {
    const migrationNames = readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith(".sql"))
      .sort();

    expect(migrationNames.slice(0, expectedFoundationMigrations.length)).toEqual(
      expectedFoundationMigrations
    );
  });

  it("contains the required foundation tables, constraints, indexes, and RLS", () => {
    const migrationSql = expectedFoundationMigrations
      .map((name) => readFileSync(resolve(migrationsDirectory, name), "utf8"))
      .join("\n")
      .toLowerCase();

    for (const table of ["idempotency_records", "outbox_events", "audit_logs"]) {
      expect(migrationSql).toContain(`create table ${table}`);
      expect(migrationSql).toContain(`alter table ${table} enable row level security`);
    }

    expect(migrationSql).toContain("unique (actor_id, scope, idempotency_key)");
    expect(migrationSql).toContain("dedupe_key text not null unique");
    expect(migrationSql).toContain("create index");
  });

  it("does not contain committed credential values", () => {
    const migrationSql = expectedFoundationMigrations
      .map((name) => readFileSync(resolve(migrationsDirectory, name), "utf8"))
      .join("\n");

    expect(migrationSql).not.toMatch(/sk-[A-Za-z0-9_-]{12,}/);
    expect(migrationSql).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{12,}/i);
    expect(migrationSql).not.toMatch(/service_role\s*[:=]\s*['"][^'"]+['"]/i);
    expect(migrationSql).not.toMatch(/password\s*[:=]\s*['"][^'"]+['"]/i);
  });
});
