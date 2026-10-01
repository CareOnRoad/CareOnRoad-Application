import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "..", "..", "supabase", "migrations");
const expectedMigrations = [
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
  "202606250032_live_location_tracking.sql",
  "202606250033_rescue_quote_payment_workflow.sql",
  "202606250034_maintenance_quote_payment_workflow.sql",
  "202606250035_maintenance_reservations_notification_leases.sql"
] as const;

const migrationSql = expectedMigrations
  .map((name) => readFileSync(resolve(migrationsDirectory, name), "utf8"))
  .join("\n")
  .toLowerCase();

describe("complete migration set", () => {
  it("uses the authoritative contiguous migration sequence", () => {
    const migrationNames = readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith(".sql"))
      .sort();

    expect(migrationNames).toEqual(expectedMigrations);
    expect(migrationNames).not.toContain("202606250015_indexes_constraints_rls.sql");
  });

  it("contains every closed enum and status value owned by implemented patches", () => {
    expectEnumValues("outbox_status", [
      "pending",
      "processing",
      "processed",
      "dead_letter"
    ]);
    expectEnumValues("request_status", [
      "submitted",
      "dispatching",
      "offered",
      "assigned",
      "mechanic_en_route",
      "in_service",
      "awaiting_quote_approval",
      "awaiting_payment",
      "completed",
      "manual_escalation",
      "canceled"
    ]);
    expectEnumValues("dispatch_candidate_status", [
      "pending",
      "offered",
      "accepted",
      "rejected",
      "expired",
      "cancelled"
    ]);
    expectEnumValues("assignment_status", [
      "accepted",
      "en_route",
      "on_site",
      "diagnosis",
      "quoted",
      "awaiting_payment",
      "in_progress",
      "completed",
      "canceled"
    ]);
    expectEnumValues("quote_status", [
      "pending",
      "approved",
      "rejected",
      "superseded",
      "expired"
    ]);
    expectEnumValues("reminder_occurrence_status", [
      "due",
      "queued",
      "sent",
      "dismissed",
      "failed"
    ]);
    expectEnumValues("notification_status", ["pending", "sent", "failed"]);
    expectEnumValues("payment_provider", ["payos"]);
    expectEnumValues("payment_order_status", [
      "created",
      "pending",
      "succeeded",
      "failed",
      "canceled",
      "needs_review"
    ]);
    expect(migrationSql).toContain(
      "alter type mechanic_profile_status add value if not exists 'rejected'"
    );
    expect(migrationSql).toContain(
      "alter type assignment_status add value if not exists 'recovery_canceled'"
    );
  });

  it("retains required uniqueness, consistency, pagination, and cleanup indexes", () => {
    for (const requiredSql of [
      "dedupe_key text not null unique",
      "unique (actor_id, scope, idempotency_key)",
      "unique (rule_id, due_at)",
      "assignments_one_active_request_idx",
      "assignments_one_active_mechanic_idx",
      "quotes_one_pending_request_idx",
      "service_requests_reminder_context_unique_idx",
      "diagnosis_results_session_latest_idx",
      "idempotency_records_cleanup_idx",
      "outbox_events_processed_retention_idx",
      "audit_logs_created_retention_idx",
      "service_requests_rider_pagination_idx",
      "chatbot_messages_created_retention_idx",
      "service_requests_motorcycle_owner_fk",
      "assignments_candidate_identity_fk",
      "diagnosis_results_message_session_fk",
      "mechanic_profiles_admin_status_available_updated_idx",
      "assignments_mechanic_history_idx",
      "payment_orders_active_quote_idx",
      "payment_events_order_received_idx",
      "dispatch_rounds_due_claim_idx",
      "device_delivery_credentials_one_active_fingerprint_idx",
      "device_delivery_credentials_one_active_device_idx"
      ,"notification_delivery_receipts_notification_status_idx",
      "notifications_user_unread_created_idx"
      ,"assignment_live_locations_expiry_idx"
    ]) {
      expect(migrationSql).toContain(requiredSql);
    }
  });

  it("enables RLS for every persistent application table", () => {
    for (const table of [
      "idempotency_records",
      "outbox_events",
      "audit_logs",
      "app_users",
      "user_roles",
      "user_devices",
      "device_delivery_credentials",
      "notification_delivery_receipts",
      "motorcycles",
      "mechanic_profiles",
      "mechanic_skills",
      "daily_request_sequences",
      "service_requests",
      "request_media_metadata",
      "request_status_history",
      "dispatch_rounds",
      "dispatch_candidates",
      "assignments",
      "assignment_status_history",
      "mechanic_diagnoses",
      "quotes",
      "quote_lines",
      "reminder_rules",
      "reminder_occurrences",
      "notifications",
      "chatbot_sessions",
      "chatbot_messages",
      "diagnosis_results",
      "admin_internal_notes",
      "assignment_eta_metadata",
      "assignment_media_metadata",
      "assignment_completion_checklists",
      "payment_orders",
      "payment_events"
      ,"assignment_live_locations"
    ]) {
      expect(migrationSql).toContain(`alter table ${table} enable row level security`);
    }

    for (const policy of [
      "app_users_self_select",
      "user_devices_owner_select",
      "motorcycles_owner_select",
      "service_requests_actor_select",
      "dispatch_candidates_rider_select",
      "notifications_owner_select",
      "chatbot_sessions_owner_select"
    ]) {
      expect(migrationSql).toContain(`create policy ${policy}`);
    }
  });

  it("contains no refund, payout, or odometer schema", () => {
    expect(migrationSql).not.toMatch(/\brefund(?:s|ed|_|\b)/);
    expect(migrationSql).not.toMatch(/\bpayout(?:s|_|\b)/);
    expect(migrationSql).not.toMatch(/\b(?:odometer|kilometer|mileage)(?:_|\b)/);
  });
});

function expectEnumValues(typeName: string, values: string[]) {
  const declaration = migrationSql.match(
    new RegExp(`create type ${typeName} as enum \\(([\\s\\S]*?)\\);`)
  )?.[1];
  expect(declaration, `${typeName} declaration`).toBeDefined();
  for (const value of values) {
    expect(declaration).toContain(`'${value}'`);
  }
}
