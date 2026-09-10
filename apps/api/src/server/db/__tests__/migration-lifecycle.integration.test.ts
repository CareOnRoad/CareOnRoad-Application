import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";

import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase
} from "@/server/testing/postgres-test-context";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationsDirectory = resolve(process.cwd(), "..", "..", "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();

describeDatabase("complete migration lifecycle", () => {
  it("supports a clean transactional reset with no schema residue", async () => {
    const context = await createIsolatedPostgresTestContext();
    const rollbackMarker = new Error("ROLLBACK_COMPLETE_MIGRATION_SET");

    try {
      await expect(
        context.sql.begin(async (transaction) => {
          await applyMigrations(transaction, migrationFiles);
          const tables = await applicationTables(transaction, context.schema);
          expect(tables).toEqual(
            expect.arrayContaining([
              "app_users",
              "service_requests",
              "assignments",
              "notifications",
              "chatbot_sessions",
              "diagnosis_results"
            ])
          );
          throw rollbackMarker;
        })
      ).rejects.toBe(rollbackMarker);

      await expect(applicationTables(context.sql, context.schema)).resolves.toHaveLength(0);
    } finally {
      await context.dispose();
    }
  }, 120_000);

  it("applies every migration sequentially and exposes final constraints, indexes, and policies", async () => {
    const context = await createIsolatedPostgresTestContext();

    try {
      const applied: string[] = [];
      for (const migrationFile of migrationFiles) {
        await applyMigrations(context.sql, [migrationFile]);
        applied.push(migrationFile);
      }

      expect(applied).toEqual([
        "202606250001_enable_extensions.sql",
        "202606250002_outbox_audit_idempotency.sql",
        "202606250003_rls_foundation.sql",
        "202606250004_identity_and_roles.sql",
        "202606250005_user_devices.sql",
        "202606250006_motorcycles_and_mechanics.sql",
        "202606250007_service_requests.sql",
        "202606250008_dispatch_candidates.sql",
        "202606250009_assignments.sql",
        "202606250010_diagnoses_and_quotes.sql",
        "202606250011_reminders.sql",
        "202606250012_notifications_outbox_audit.sql",
        "202606250013_chatbot_persistence.sql",
        "202606250014_indexes_constraints_rls.sql",
        "202606250015_admin_foundation.sql",
        "202606250016_admin_mechanic_management.sql",
        "202606250017_assignment_eta_metadata.sql",
        "202606250018_assignment_media_metadata.sql",
        "202606250019_assignment_completion_checklists.sql",
        "202606250020_payments.sql",
        "202606250021_dispatch_round_leases.sql",
        "202606250022_push_device_tokens.sql",
        "202606250023_notification_provider_delivery.sql",
        "202606250024_notification_inbox_index.sql",
        "202606250025_media_upload_intents.sql",
        "202606250026_service_reviews.sql",
        "202606250027_assignment_recovery.sql",
        "202606250028_operational_monitoring.sql",
        "202606250029_distributed_runtime_controls.sql",
        "202606250030_chatbot_session_ownership.sql",
        "202606250031_data_retention_worker.sql",
        "202606250032_live_location_tracking.sql"
      ]);

      const tables = await applicationTables(context.sql, context.schema);
      expect(tables).toHaveLength(41);

      const indexes = await context.sql<{ indexname: string }[]>`
        select indexname
        from pg_indexes
        where schemaname = ${context.schema}
          and indexname in (
            'idempotency_records_cleanup_idx',
            'outbox_events_processed_retention_idx',
            'service_requests_rider_pagination_idx',
            'assignments_candidate_identity_fk',
            'chatbot_messages_created_retention_idx',
            'worker_run_records_completed_idx',
            'runtime_rate_limit_buckets_expiry_idx',
            'assignment_live_locations_expiry_idx'
          )
        order by indexname
      `;
      expect(indexes.map((row) => row.indexname)).toEqual([
        "assignment_live_locations_expiry_idx",
        "chatbot_messages_created_retention_idx",
        "idempotency_records_cleanup_idx",
        "outbox_events_processed_retention_idx",
        "runtime_rate_limit_buckets_expiry_idx",
        "service_requests_rider_pagination_idx",
        "worker_run_records_completed_idx"
      ]);

      const constraints = await context.sql<{ conname: string }[]>`
        select constraint_name as conname
        from information_schema.table_constraints
        where constraint_schema = ${context.schema}
          and constraint_name in (
            'service_requests_motorcycle_owner_fk',
            'assignments_candidate_identity_fk',
            'mechanic_diagnoses_assignment_identity_fk',
            'diagnosis_results_message_session_fk'
          )
        order by constraint_name
      `;
      expect(constraints.map((row) => row.conname)).toEqual([
        "assignments_candidate_identity_fk",
        "diagnosis_results_message_session_fk",
        "mechanic_diagnoses_assignment_identity_fk",
        "service_requests_motorcycle_owner_fk"
      ]);

      const policies = await context.sql<{ policyname: string }[]>`
        select policyname
        from pg_policies
        where schemaname = ${context.schema}
          and policyname in (
            'app_users_self_select',
            'motorcycles_owner_select',
            'service_requests_actor_select',
            'dispatch_candidates_rider_select',
            'chatbot_sessions_owner_select'
          )
        order by policyname
      `;
      expect(policies.map((row) => row.policyname)).toEqual([
        "app_users_self_select",
        "chatbot_sessions_owner_select",
        "dispatch_candidates_rider_select",
        "motorcycles_owner_select",
        "service_requests_actor_select"
      ]);
    } finally {
      await context.dispose();
    }
  }, 120_000);
});

async function applicationTables(
  sql: Pick<Sql, "unsafe">,
  schema: string
): Promise<string[]> {
  const rows = (await sql.unsafe(
    `select table_name
     from information_schema.tables
     where table_schema = $1
       and table_type = 'BASE TABLE'
     order by table_name`,
    [schema]
  )) as unknown as { table_name: string }[];
  return rows.map((row) => row.table_name);
}

async function applyMigrations(
  sql: Pick<Sql, "unsafe">,
  migrationNames: readonly string[]
): Promise<void> {
  for (const migrationFile of migrationNames) {
    await sql.unsafe(readFileSync(resolve(migrationsDirectory, migrationFile), "utf8"));
  }
}
