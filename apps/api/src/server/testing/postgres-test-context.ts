import { randomUUID } from "node:crypto";

import postgres, { type Sql } from "postgres";
import {
  requirePostgresTestDatabaseUrl as requireDedicatedTestDatabase,
  type PostgresTestEnvironment
} from "../db/database-environment.mjs";
export type { PostgresTestEnvironment } from "../db/database-environment.mjs";

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const POSTGRES_TEST_DATABASE_ENV = "TEST_DATABASE_URL";
export const RUN_POSTGRES_TESTS_ENV = "RUN_DB_TESTS";

export type PostgresCleanupExecutor = {
  unsafe(query: string): Promise<unknown>;
};

export type PostgresCleanupOptions = {
  resetAppendOnlyTables?: boolean;
};

export type IsolatedPostgresTestContext = {
  sql: Sql;
  schema: string;
  dispose(options?: PostgresTestDisposeOptions): Promise<void>;
};

export type PostgresTestContextOptions = {
  maxConnections?: number;
};

export type PostgresTestDisposeOptions = {
  authUserIds?: string[];
};

export function hasPostgresTestDatabase(environment: PostgresTestEnvironment = process.env): boolean {
  return isEnabled(environment.RUN_DB_TESTS) && Boolean(environment.TEST_DATABASE_URL?.trim());
}

export function requirePostgresTestDatabaseUrl(
  environment: PostgresTestEnvironment = process.env
): string {
  return requireDedicatedTestDatabase(environment);
}

export async function createIsolatedPostgresTestContext(
  environment: PostgresTestEnvironment = process.env,
  options: PostgresTestContextOptions = {}
): Promise<IsolatedPostgresTestContext> {
  const rawUrl = requirePostgresTestDatabaseUrl(environment);

  const schema = `careonroad_test_${randomUUID().replaceAll("-", "")}`;
  const adminSql = postgres(rawUrl, { max: 1, prepare: false });
  await adminSql.unsafe(`create schema "${schema}"`);

  const sql = postgres(rawUrl, {
    max: options.maxConnections ?? 1,
    prepare: false,
    connection: {
      search_path: `"${schema}", public`
    }
  });

  return {
    sql,
    schema,
    async dispose(options: PostgresTestDisposeOptions = {}) {
      await sql.end({ timeout: 5 });
      try {
        await adminSql.unsafe(`drop schema if exists "${schema}" cascade`);
        if (options.authUserIds?.length) {
          await adminSql`
            delete from auth.users
            where id = any(${options.authUserIds})
          `;
        }
      } finally {
        await adminSql.end({ timeout: 5 });
      }
    }
  };
}

export async function cleanupPostgresTables(
  executor: PostgresCleanupExecutor,
  tableNames: readonly string[],
  options: PostgresCleanupOptions = {}
): Promise<void> {
  const uniqueTableNames = [...new Set(tableNames)];
  if (uniqueTableNames.length === 0) {
    return;
  }

  uniqueTableNames.forEach(quoteQualifiedIdentifier);
  const [row] = await executor.unsafe("SELECT current_schema() AS schema") as { schema: string }[];
  if (!/^careonroad_test_[a-f0-9]{32}$/.test(row?.schema ?? "")) {
    throw new Error("PostgreSQL cleanup requires an isolated test schema.");
  }
  const quotedTables = uniqueTableNames.map((name) => {
    const parts = name.split(".");
    if (parts.length === 2 && parts[0] !== row.schema) {
      throw new Error("PostgreSQL cleanup cannot target another schema.");
    }
    return quoteQualifiedIdentifier(`${row.schema}.${parts.at(-1)}`);
  });
  const truncate = `TRUNCATE TABLE ${quotedTables.join(", ")} RESTART IDENTITY CASCADE;`;
  if (!options.resetAppendOnlyTables) {
    await executor.unsafe(truncate);
    return;
  }
  const guards = await executor.unsafe(`
    SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled AS mode
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema() AND NOT t.tgisinternal
      AND (t.tgtype & 32) <> 0 AND t.tgenabled <> 'D'
  `) as { table_name: string; trigger_name: string; mode: string }[];
  const alter = (guard: typeof guards[number], action: string) =>
    `ALTER TABLE ${quoteQualifiedIdentifier(`${row.schema}.${guard.table_name}`)} ${action} TRIGGER ${quoteQualifiedIdentifier(guard.trigger_name)};`;
  // One atomic statement restores all guards automatically if cleanup fails.
  await executor.unsafe(`DO $cleanup$ BEGIN
    ${guards.map((guard) => alter(guard, "DISABLE")).join("\n")}
    ${truncate}
    ${guards.map((guard) => alter(guard, guard.mode === "A" ? "ENABLE ALWAYS" : guard.mode === "R" ? "ENABLE REPLICA" : "ENABLE")).join("\n")}
  END $cleanup$;`);
}

function quoteQualifiedIdentifier(identifier: string): string {
  const parts = identifier.split(".");

  if (parts.length > 2 || parts.some((part) => !SAFE_IDENTIFIER.test(part))) {
    throw new Error(`Unsafe PostgreSQL test table identifier: ${identifier}`);
  }

  return parts.map((part) => `"${part}"`).join(".");
}

function isEnabled(value: string | undefined): boolean {
  return /^(1|true|yes)$/i.test(value?.trim() ?? "");
}
