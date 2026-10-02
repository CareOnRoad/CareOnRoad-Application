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
  resetAppendOnlyAuditLogs?: boolean;
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

  const quotedTables = uniqueTableNames.map(quoteQualifiedIdentifier);
  const auditLogTable = uniqueTableNames.find((name) => name.split(".").at(-1) === "audit_logs");
  const quotedAuditLogTable = auditLogTable ? quoteQualifiedIdentifier(auditLogTable) : undefined;

  if (options.resetAppendOnlyAuditLogs && quotedAuditLogTable) {
    await executor.unsafe(
      `ALTER TABLE ${quotedAuditLogTable} DISABLE TRIGGER audit_logs_reject_truncate`
    );
  }

  try {
    await executor.unsafe(`TRUNCATE TABLE ${quotedTables.join(", ")} RESTART IDENTITY CASCADE`);
  } finally {
    if (options.resetAppendOnlyAuditLogs && quotedAuditLogTable) {
      await executor.unsafe(
        `ALTER TABLE ${quotedAuditLogTable} ENABLE TRIGGER audit_logs_reject_truncate`
      );
    }
  }
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
