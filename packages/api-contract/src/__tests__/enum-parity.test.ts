import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { serviceTypes, userRoles, userStatuses } from "../enums";

/**
 * Guards the contract package against drifting away from the PostgreSQL enums
 * it mirrors. A mismatch here would only surface at runtime as a database
 * rejection, so it is asserted at test time instead.
 */

const MIGRATIONS_DIR = resolve(import.meta.dirname, "..", "..", "..", "..", "supabase", "migrations");

const IDENTITY_MIGRATION = "202606250004_identity_and_roles.sql";
const MOTORCYCLE_MIGRATION = "202606250006_motorcycles_and_mechanics.sql";

function readMigration(fileName: string): string {
  return readFileSync(resolve(MIGRATIONS_DIR, fileName), "utf8");
}

/**
 * Extracts the string literals declared inside `create type <name> as enum (...)`.
 */
function readPostgresEnum(sql: string, typeName: string): string[] {
  const declaration = new RegExp(
    `create\\s+type\\s+${typeName}\\s+as\\s+enum\\s*\\(([^)]*)\\)`,
    "i"
  ).exec(sql);

  if (!declaration?.[1]) {
    throw new Error(`Could not find "create type ${typeName} as enum (...)" in the migration.`);
  }

  return [...declaration[1].matchAll(/'([^']+)'/g)].map((match) => match[1] as string);
}

describe("enum parity with PostgreSQL", () => {
  it("userRoles matches the app_role enum", () => {
    const sql = readMigration(IDENTITY_MIGRATION);
    expect([...userRoles].sort()).toEqual(readPostgresEnum(sql, "app_role").sort());
  });

  it("userStatuses matches the user_status enum", () => {
    const sql = readMigration(IDENTITY_MIGRATION);
    expect([...userStatuses].sort()).toEqual(readPostgresEnum(sql, "user_status").sort());
  });

  it("serviceTypes matches the service_type enum", () => {
    const sql = readMigration(MOTORCYCLE_MIGRATION);
    expect([...serviceTypes].sort()).toEqual(readPostgresEnum(sql, "service_type").sort());
  });
});
