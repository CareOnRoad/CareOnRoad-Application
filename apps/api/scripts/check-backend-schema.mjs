// Read-only release gate. Prints checks/counts and hashed IDs, never URLs or raw errors.
/* global console */
import process from "node:process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";
import { loadEnv } from "vite";
import { checkBackendSchema, REQUIRED_BACKEND_SCHEMA_VERSION } from "../src/server/db/backend-schema.mjs";
import { databaseIdentity, requirePostgresTestDatabaseUrl } from "../src/server/db/database-environment.mjs";

const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(api, "../..");
const target = process.argv.includes("--test") ? "test" : "application";
const evidence = { checked_at: new Date().toISOString(), read_only: true, target,
  required_schema_version: REQUIRED_BACKEND_SCHEMA_VERSION, status: "unverified", release_ready: false };
let sql;
try {
  const env = { ...loadEnv("test", root, ""), ...loadEnv("test", api, ""), ...process.env };
  const appIdentity = databaseIdentity(env.DATABASE_URL);
  const testIdentity = databaseIdentity(env.TEST_DATABASE_URL);
  evidence.separate_test_database = Boolean(appIdentity && testIdentity && appIdentity !== testIdentity);
  const databaseUrl = target === "test"
    ? requirePostgresTestDatabaseUrl({ ...env, NODE_ENV: "test", RUN_DB_TESTS: "true" }) : env.DATABASE_URL;
  if (!databaseIdentity(databaseUrl)) throw new Error("INVALID_DATABASE_CONFIGURATION");
  sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 5,
    connection: { statement_timeout: "5000" } });
  await sql.begin("read only", async (tx) => {
    const checks = await checkBackendSchema(tx);
    const versions = await tx`select version from supabase_migrations.schema_migrations order by version`;
    const expected = readdirSync(path.join(root, "supabase/migrations"))
      .filter(file => file.endsWith(".sql")).map(file => file.split("_")[0]);
    Object.assign(evidence, { status: "connected", schema_checks: checks,
      migration_count: versions.length, last_migration: versions.at(-1)?.version ?? null,
      source_migrations_recorded: expected.every(version => versions.some(item => item.version === version)),
      migration_035_recorded: versions.some(item => item.version === "202606250035"),
      required_migration_recorded: versions.some(item => item.version === REQUIRED_BACKEND_SCHEMA_VERSION) });
    evidence.release_ready = Object.values(checks).every(value => value === true) && evidence.source_migrations_recorded;
    if (process.argv.includes("--inventory")) evidence.data_repair_dry_run = await inventory(tx, checks.columns);
  });
} catch (error) {
  evidence.status = "unverified";
  evidence.release_ready = false;
  evidence.code = target === "test" && !evidence.separate_test_database ? "TEST_DATABASE_ISOLATION_REQUIRED"
    : /^[A-Z0-9]{5}$/.test(error?.code ?? "") ? error.code : "DATABASE_CHECK_FAILED";
} finally {
  await sql?.end({ timeout: 1 }).catch(() => {
    evidence.release_ready = false;
    evidence.code = "DATABASE_CLOSE_FAILED";
  });
}
console.log(JSON.stringify(evidence, null, 2));
if (!evidence.release_ready) process.exitCode = 1;

async function inventory(tx, hasReservationColumns) {
  const queries = {
    latest_terminal_assignment_request_mismatch: `select a.id, 'assignment' as entity_type
      from assignments a join service_requests r on r.id = a.request_id
      where ((a.status = 'canceled' and r.status <> 'canceled')
        or (a.status = 'completed' and r.status <> 'completed')
        or (a.status = 'recovery_canceled' and r.status in ('assigned', 'mechanic_en_route', 'in_service', 'awaiting_quote_approval', 'awaiting_payment')))
        and not exists (select 1 from assignments newer where newer.request_id = a.request_id
          and (newer.created_at, newer.id) > (a.created_at, a.id))`,
    standard_zero_quotes: `select id, 'quote' as entity_type from quotes
      where coalesce(purpose::text, 'standard') = 'standard' and total_amount = 0 and status in ('pending', 'approved')`,
    requests_without_coordinates: `select id, 'service_request' as entity_type from service_requests
      where service_location is null and status not in ('completed', 'canceled')`,
    mechanic_profiles_without_role: `select p.user_id as id, 'mechanic_profile' as entity_type from mechanic_profiles p
      where not exists (select 1 from user_roles roles where roles.user_id = p.user_id and roles.role = 'mechanic')`,
    scheduled_assignments_needing_review: `select a.id, 'assignment' as entity_type from assignments a
      join service_requests r on r.id = a.request_id where a.status in
        ('accepted', 'en_route', 'on_site', 'diagnosis', 'quoted', 'awaiting_payment', 'in_progress') and r.scheduled_start_at is not null
      ${hasReservationColumns ? "and (a.scheduled_start_at is null or a.reservation_start_at is null or a.reservation_end_at is null)" : ""}`,
    overdue_unactivated_appointments: hasReservationColumns ? `select id, 'assignment' as entity_type from assignments
      where scheduled_start_at < now() and activated_at is null and status in
        ('accepted', 'en_route', 'on_site', 'diagnosis', 'quoted', 'awaiting_payment', 'in_progress')` : `select id, 'assignment' as entity_type from assignments where false`,
    inactive_assignments_with_payments: `select distinct a.id, 'assignment' as entity_type from assignments a
      join payment_orders p on p.assignment_id = a.id where a.status in ('canceled', 'recovery_canceled')
        and p.status in ('created', 'pending', 'succeeded', 'needs_review')`
  };
  const groups = {};
  for (const [name, query] of Object.entries(queries)) {
    const rows = await tx.unsafe(`with candidates as (${query})
      select md5(id::text) as id_hash, entity_type, (count(*) over ())::integer as total_count
      from candidates order by id limit 100`);
    groups[name] = { count: rows[0]?.total_count ?? 0,
      truncated: (rows[0]?.total_count ?? 0) > rows.length,
      items: rows.map(({ id_hash, entity_type }) => ({ id_hash, entity_type })) };
  }
  return { execution: "read_only", automatic_repair: false, sample_limit: 100,
    reservation_inventory_complete: hasReservationColumns, groups };
}
