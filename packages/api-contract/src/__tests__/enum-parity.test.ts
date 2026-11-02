import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { serviceTypes, userRoles, userStatuses } from "../enums";
import {
  fulfillmentModes,
  requestPriorities,
  requestStatuses
} from "../admin-service-requests";
import { mechanicProfileStatuses } from "../admin-mechanics";

/**
 * Guards the contract package against drifting away from the PostgreSQL enums
 * it mirrors. A mismatch here would only surface at runtime as a database
 * rejection, so it is asserted at test time instead.
 *
 * The admin-facing value sets below are NOT PostgreSQL enums — they are
 * TS-only business rules that happen to enumerate the same values. They are
 * pinned here anyway, because the admin API sends them straight into
 * `where` clauses and enum casts: a value that exists in TypeScript but not
 * in the database becomes a runtime SQL error, not a type error.
 */

const MIGRATIONS_DIR = resolve(import.meta.dirname, "..", "..", "..", "..", "supabase", "migrations");

const IDENTITY_MIGRATION = "202606250004_identity_and_roles.sql";
const MOTORCYCLE_MIGRATION = "202606250006_motorcycles_and_mechanics.sql";
const SERVICE_REQUEST_MIGRATION = "202606250007_service_requests.sql";
const ADMIN_MECHANIC_MIGRATION = "202606250016_admin_mechanic_management.sql";

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

/**
 * Extracts the value of `alter type <name> add value '<value>'`.
 *
 * `mechanic_profile_status` is created with four values and gains a fifth
 * one (`rejected`) in a later migration, so the initial declaration alone is
 * not the full enum.
 */
function readPostgresAddedEnumValues(sql: string, typeName: string): string[] {
  const pattern = new RegExp(
    `alter\\s+type\\s+${typeName}\\s+add\\s+value(?:\\s+if\\s+not\\s+exists)?\\s+'([^']+)'`,
    "gi"
  );

  return [...sql.matchAll(pattern)].map((match) => match[1]);
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

describe("admin enum parity with PostgreSQL", () => {
  it("requestStatuses matches the request_status enum", () => {
    const sql = readMigration(SERVICE_REQUEST_MIGRATION);
    expect([...requestStatuses].sort()).toEqual(
      readPostgresEnum(sql, "request_status").sort()
    );
  });

  it("requestPriorities matches the request_priority enum", () => {
    const sql = readMigration(SERVICE_REQUEST_MIGRATION);
    expect([...requestPriorities].sort()).toEqual(
      readPostgresEnum(sql, "request_priority").sort()
    );
  });

  it("fulfillmentModes matches the fulfillment_mode enum", () => {
    const sql = readMigration(SERVICE_REQUEST_MIGRATION);
    expect([...fulfillmentModes].sort()).toEqual(
      readPostgresEnum(sql, "fulfillment_mode").sort()
    );
  });

  it("mechanicProfileStatuses matches the mechanic_profile_status enum", () => {
    const created = readPostgresEnum(
      readMigration(MOTORCYCLE_MIGRATION),
      "mechanic_profile_status"
    );
    const added = readPostgresAddedEnumValues(
      readMigration(ADMIN_MECHANIC_MIGRATION),
      "mechanic_profile_status"
    );

    expect([...mechanicProfileStatuses].sort()).toEqual(
      [...created, ...added].sort()
    );
  });
});
