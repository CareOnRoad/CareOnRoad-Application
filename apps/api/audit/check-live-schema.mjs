// Read-only schema verification. Never prints environment values or database errors.
/* global console, process */
import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import postgres from "postgres";
import { loadEnv } from "vite";

const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(api, "../..");
const env = { ...loadEnv("test", root, ""), ...loadEnv("test", api, ""), ...process.env };
const identity = (value) => {
  let url;
  try { url = new URL(value); } catch { return undefined; }
  const project = /^db\.([^.]+)\.supabase\.co$/.exec(url.hostname)?.[1] ??
    (url.hostname.endsWith(".pooler.supabase.com") ? decodeURIComponent(url.username).split(".").slice(1).join(".") : undefined);
  return `${project ? `supabase:${project}` : url.hostname}:${url.pathname}`;
};
const evidence = { checked_at: new Date().toISOString(), read_only: true,
  separate_test_database: Boolean(env.TEST_DATABASE_URL && env.DATABASE_URL &&
    identity(env.TEST_DATABASE_URL) && identity(env.DATABASE_URL) &&
    identity(env.TEST_DATABASE_URL) !== identity(env.DATABASE_URL)) };
let sql;
try {
  if (!identity(env.DATABASE_URL)) throw new Error("Invalid database configuration.");
  sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 5 });
  Object.assign(evidence, await sql.begin("read only", async (tx) => {
    const versions = await tx`select version from supabase_migrations.schema_migrations order by version`;
    const columns = await tx`select table_name,column_name from information_schema.columns
      where table_schema='public' and table_name in ('assignments','notification_delivery_receipts')`;
    const has = (table, column) => columns.some(item => item.table_name === table && item.column_name === column);
    return { status: "connected", migration_count: versions.length, last_migration: versions.at(-1)?.version ?? null,
      migration_035_recorded: versions.some(item => item.version === "202606250035"),
      assignment_reservation_columns: ["scheduled_start_at", "reservation_start_at", "reservation_end_at", "activated_at"]
        .every(column => has("assignments", column)),
      notification_lease_columns: ["lease_token", "lease_expires_at", "next_attempt_at"]
        .every(column => has("notification_delivery_receipts", column)) };
  }));
  evidence.query_checks = [];
  for (const [name, query] of [
    ["assignment_columns", "select scheduled_start_at, activated_at from public.assignments limit 0"],
    ["notification_columns", "select lease_token, next_attempt_at from public.notification_delivery_receipts limit 0"]
  ]) {
    try {
      await sql.begin("read only", tx => tx.unsafe(query));
      evidence.query_checks.push({ name, status: "pass" });
    } catch (error) {
      evidence.query_checks.push({ name, status: "fail", code: error?.code ?? "DATABASE_QUERY_FAILED" });
    }
  }
} catch (error) {
  Object.assign(evidence, { status: "unverified", code: error?.code ?? "DATABASE_CONNECTION_FAILED" });
} finally {
  await sql?.end({ timeout: 1 });
}
console.log(JSON.stringify(evidence, null, 2));
if (evidence.status !== "connected" || !evidence.assignment_reservation_columns || !evidence.notification_lease_columns) process.exitCode = 1;
