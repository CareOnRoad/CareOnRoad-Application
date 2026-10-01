import { randomUUID } from "node:crypto";

import postgres, { type Sql } from "postgres";

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TEST_DATABASE_NAME = /(^|[_-])(test|testing)([_-]|$)/i;

export const POSTGRES_TEST_DATABASE_ENV = "TEST_DATABASE_URL";
export const RUN_POSTGRES_TESTS_ENV = "RUN_DB_TESTS";

export type PostgresTestEnvironment = {
  NODE_ENV?: string;
  RUN_DB_TESTS?: string;
  TEST_DATABASE_URL?: string;
  DATABASE_URL?: string;
  TEST_DATABASE_CONFIRMED?: string;
};

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
  if (environment.NODE_ENV !== "test") {
    throw new Error("PostgreSQL integration helpers require NODE_ENV=test.");
  }

  if (!isEnabled(environment.RUN_DB_TESTS)) {
    throw new Error(`${RUN_POSTGRES_TESTS_ENV}=true is required for PostgreSQL integration tests.`);
  }

  const rawUrl = environment.TEST_DATABASE_URL?.trim();
  if (!rawUrl) {
    throw new Error(`${POSTGRES_TEST_DATABASE_ENV} is required for PostgreSQL integration tests.`);
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error(`${POSTGRES_TEST_DATABASE_ENV} must be a valid PostgreSQL URL.`);
  }

  if (!POSTGRES_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error(`${POSTGRES_TEST_DATABASE_ENV} must use postgres:// or postgresql://.`);
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
  const applicationUrl = environment.DATABASE_URL?.trim();
  if (applicationUrl) {
    let app: URL;
    try { app = new URL(applicationUrl); }
    catch { throw new Error("DATABASE_URL must be valid to verify test database isolation."); }
    if (databaseIdentity(app) === databaseIdentity(parsedUrl)) throw new Error("TEST_DATABASE_URL must use a separate database from DATABASE_URL.");
  }
  if (!databaseName || (!TEST_DATABASE_NAME.test(databaseName) && !isEnabled(environment.TEST_DATABASE_CONFIRMED))) {
    throw new Error(
      `${POSTGRES_TEST_DATABASE_ENV} must target a database whose name contains a test marker, or a separate confirmed test project (TEST_DATABASE_CONFIRMED=true).`
    );
  }

  return rawUrl;
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

function databaseIdentity(url: URL): string {
  const directProject = /^db\.([^.]+)\.supabase\.co$/.exec(url.hostname)?.[1];
  const poolerProject = url.hostname.endsWith(".pooler.supabase.com") ? decodeURIComponent(url.username).split(".").slice(1).join(".") : undefined;
  return `${directProject || poolerProject ? `supabase:${directProject || poolerProject}` : url.hostname}:${url.pathname}`;
}
