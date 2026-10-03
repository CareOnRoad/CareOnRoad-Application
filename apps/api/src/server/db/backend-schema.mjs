export const REQUIRED_BACKEND_SCHEMA_VERSION = "202606250035";

// Catalog-only query: it also works when an application table/column is missing.
const SCHEMA_CHECK_SQL = `select
  not exists (
    select 1 from (values
      ('assignments', 'scheduled_start_at', 'timestamp with time zone'),
      ('assignments', 'reservation_start_at', 'timestamp with time zone'),
      ('assignments', 'reservation_end_at', 'timestamp with time zone'),
      ('assignments', 'activated_at', 'timestamp with time zone'),
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
      ('assignments', 'assignments_reservation_window_check', 'c'),
      ('assignments', 'assignments_activation_time_check', 'c'),
      ('assignments', 'assignments_reservation_no_overlap', 'x'),
      ('notification_delivery_receipts', 'notification_delivery_lease_pair_check', 'c'),
      ('service_requests', 'service_requests_periodic_maintenance_time_or_reminder_check', 'c')
    ) required(table_name, constraint_name, kind)
    where not exists (
      select 1 from pg_constraint k
      join pg_class c on c.oid = k.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname = required.table_name
        and k.conname = required.constraint_name and k.contype::text = required.kind and k.convalidated
    )
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
      ('service_requests', 'service_requests_validate_maintenance_location'),
      ('motorcycles', 'motorcycles_disable_reminders')
    ) required(table_name, trigger_name)
    where not exists (
      select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname = required.table_name
        and t.tgname = required.trigger_name and not t.tgisinternal and t.tgenabled <> 'D'
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
