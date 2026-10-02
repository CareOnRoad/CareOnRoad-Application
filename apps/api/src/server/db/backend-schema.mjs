export const REQUIRED_BACKEND_SCHEMA_VERSION = "202606250046";

// Catalog-only query: it also works when an application table/column is missing.
const SCHEMA_CHECK_SQL = `select
  not exists (
    select 1 from (values
      ('dispatch_rounds', 'policy_snapshot', 'jsonb'),
      ('admin_operation_configs', 'config_key', 'text'),
      ('admin_operation_config_versions', 'new_value_json', 'jsonb'),
      ('notifications', 'admin_retry_count', 'integer'),
      ('notifications', 'canceled_at', 'timestamp with time zone'),
      ('outbox_events', 'admin_retry_count', 'integer'),
      ('outbox_events', 'abandoned_at', 'timestamp with time zone'),
      ('admin_supervision_actions', 'action', 'text'),
      ('assignments', 'source', 'text'),
      ('assignments', 'assigned_by_admin_id', 'uuid'),
      ('assignments', 'supersedes_assignment_id', 'uuid'),
      ('assignments', 'dispatch_distance_m', 'integer'),
      ('assignments', 'scheduled_start_at', 'timestamp with time zone'),
      ('assignments', 'reservation_start_at', 'timestamp with time zone'),
      ('assignments', 'reservation_end_at', 'timestamp with time zone'),
      ('assignments', 'activated_at', 'timestamp with time zone'),
      ('service_requests', 'dispatch_episode_start_round', 'integer'),
      ('service_requests', 'dispatch_retry_count', 'integer'),
      ('notification_delivery_receipts', 'lease_token', 'text'),
      ('notification_delivery_receipts', 'lease_expires_at', 'timestamp with time zone'),
      ('notification_delivery_receipts', 'next_attempt_at', 'timestamp with time zone')
    ) required(table_name, column_name, data_type)
    where not exists (
      select 1 from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname = required.table_name
        and a.attname = required.column_name and a.attnum > 0 and not a.attisdropped
        and format_type(a.atttypid, a.atttypmod) = required.data_type
    )
  ) as columns,
  not exists (
    select 1 from (values
      ('notifications', 'notifications_canceled_provenance_check', 'c'),
      ('notifications', 'notifications_delivery_state_check', 'c'),
      ('outbox_events', 'outbox_abandoned_provenance_check', 'c'),
      ('assignments', 'assignments_source_check', 'c'),
      ('assignments', 'assignments_reservation_window_check', 'c'),
      ('assignments', 'assignments_activation_time_check', 'c'),
      ('assignments', 'assignments_reservation_no_overlap', 'x'),
      ('notification_delivery_receipts', 'notification_delivery_lease_pair_check', 'c'),
      ('service_requests', 'service_requests_periodic_maintenance_time_or_reminder_check', 'c'),
      ('service_requests', 'service_requests_dispatch_episode_check', 'c')
    ) required(table_name, constraint_name, kind)
    where not exists (
      select 1 from pg_constraint k
      join pg_class c on c.oid = k.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname = required.table_name
        and k.conname = required.constraint_name and k.contype::text = required.kind and k.convalidated
    )
  ) and not exists (
    select 1 from (values ('quote_status', 'voided'), ('notification_status', 'canceled'),
      ('notification_delivery_status', 'canceled'), ('outbox_status', 'abandoned')) required(type_name, label)
    where not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = $1 and t.typname = required.type_name and e.enumlabel = required.label)
  ) and exists (
    select 1 from pg_constraint k join pg_class c on c.oid=k.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=$1 and c.relname='dispatch_rounds'
      and k.conname='dispatch_rounds_radius_m_check' and k.convalidated
      and pg_get_constraintdef(k.oid) like '%radius_m >= 1000%'
      and pg_get_constraintdef(k.oid) like '%radius_m <= 100000%'
  ) as constraints,
  exists (
    select 1 from pg_index i
    join pg_class c on c.oid = i.indexrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = $1 and c.relname = 'assignments_one_active_mechanic_idx'
      and i.indisunique and i.indisvalid
      and pg_get_expr(i.indpred, i.indrelid) like '%scheduled_start_at%'
      and pg_get_expr(i.indpred, i.indrelid) like '%activated_at%'
  ) and exists (
    select 1 from pg_index i
    join pg_class c on c.oid = i.indexrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = $1 and c.relname = 'assignments_scheduled_preparation_idx' and i.indisvalid
  ) as indexes,
  not exists (
    select 1 from (values
      ('notifications', 'notifications_canceled_guard'),
      ('outbox_events', 'outbox_domain_identity_guard'),
      ('admin_supervision_actions', 'admin_supervision_append_only'),
      ('admin_supervision_actions', 'admin_supervision_reject_truncate'),
      ('quotes', 'quotes_supervision_void_guard'),
      ('service_requests', 'service_requests_location_guard'),
      ('motorcycles', 'motorcycles_disable_reminders'),
      ('reminder_rules', 'reminder_rules_owner_guard'),
      ('dispatch_rounds', 'dispatch_rounds_policy_guard'),
      ('admin_operation_configs', 'admin_operation_configs_budget_guard'),
      ('admin_operation_config_versions', 'admin_operation_config_versions_append_only'),
      ('admin_operation_config_versions', 'admin_operation_config_versions_reject_truncate'),
      ('mechanic_profiles', 'mechanic_profiles_require_mechanic_role')
    ) required(table_name, trigger_name)
    where not exists (
      select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname = required.table_name
        and t.tgname = required.trigger_name and not t.tgisinternal and t.tgenabled <> 'D'
        and (required.trigger_name <> 'mechanic_profiles_require_mechanic_role' or t.tgattr::text <> '')
    )
  ) as triggers,
  exists (select 1 from pg_extension where extname = 'btree_gist') as extensions`;

export async function checkBackendSchema(sql, schema = "public") {
  const [checks] = await sql.unsafe(SCHEMA_CHECK_SQL, [schema]);
  return checks;
}

export async function assertBackendSchema(sql, schema = "public") {
  const checks = await checkBackendSchema(sql, schema);
  if (!checks || !["columns", "constraints", "indexes", "triggers", "extensions"].every((key) => checks[key] === true)) {
    throw new Error("BACKEND_SCHEMA_INCOMPATIBLE");
  }
}
