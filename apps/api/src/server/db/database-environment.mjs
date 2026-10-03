import { URL } from "node:url";

export function databaseIdentity(value) {
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return undefined;
    const directProject = /^db\.([^.]+)\.supabase\.co$/.exec(url.hostname)?.[1];
    const poolerProject = url.hostname.endsWith(".pooler.supabase.com")
      ? decodeURIComponent(url.username).split(".").slice(1).join(".") : undefined;
    if (url.hostname.endsWith(".pooler.supabase.com") && !poolerProject) return undefined;
    const host = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ? "localhost" : url.hostname;
    const server = directProject || poolerProject
      ? `supabase:${directProject || poolerProject}` : `${host}:${url.port || "5432"}`;
    return `${server}:${decodeURIComponent(url.pathname)}`;
  } catch { return undefined; }
}

export function requirePostgresTestDatabaseUrl(environment) {
  if (environment.NODE_ENV !== "test") throw new Error("PostgreSQL integration helpers require NODE_ENV=test.");
  if (!isEnabled(environment.RUN_DB_TESTS)) throw new Error("RUN_DB_TESTS=true is required for PostgreSQL integration tests.");
  const rawUrl = environment.TEST_DATABASE_URL?.trim();
  if (!rawUrl) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests.");
  const testIdentity = databaseIdentity(rawUrl);
  if (!testIdentity) throw new Error("TEST_DATABASE_URL must be a valid postgres:// or postgresql:// URL.");
  const appUrl = environment.DATABASE_URL?.trim();
  if (appUrl && !databaseIdentity(appUrl)) throw new Error("DATABASE_URL must be valid to verify test database isolation.");
  if (appUrl && databaseIdentity(appUrl) === testIdentity) {
    throw new Error("TEST_DATABASE_URL must use a separate database from DATABASE_URL.");
  }
  const name = decodeURIComponent(new URL(rawUrl).pathname.replace(/^\/+/, ""));
  if (!name || (!/(^|[_-])(test|testing)([_-]|$)/i.test(name) && !isEnabled(environment.TEST_DATABASE_CONFIRMED))) {
    throw new Error("TEST_DATABASE_URL must target a database whose name contains a test marker, or a separate confirmed test project (TEST_DATABASE_CONFIRMED=true).");
  }
  return rawUrl;
}

function isEnabled(value) {
  return /^(1|true|yes)$/i.test(value?.trim() ?? "");
}
