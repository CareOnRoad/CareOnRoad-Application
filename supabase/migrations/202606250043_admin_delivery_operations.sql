alter table notifications
  add column admin_retry_count integer not null default 0 check (admin_retry_count between 0 and 3),
  add column recovery_admin_id uuid references app_users(id) on delete restrict,
  add column recovery_reason text check (recovery_reason is null or length(recovery_reason) between 10 and 500),
  add column recovery_at timestamptz,
  add column canceled_at timestamptz,
  add constraint notifications_canceled_provenance_check check (
    (status::text = 'canceled' and canceled_at is not null and recovery_admin_id is not null and recovery_reason is not null)
    or (status::text <> 'canceled' and canceled_at is null));

-- Replace the original anonymous status constraint without relying on its generated suffix.
do $$ declare constraint_record record; begin
  for constraint_record in select conname from pg_constraint where conrelid = 'notifications'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%' and pg_get_constraintdef(oid) like '%last_error_code%' loop
    execute format('alter table notifications drop constraint %I', constraint_record.conname);
  end loop;
end $$;
alter table notifications add constraint notifications_delivery_state_check check (
  (status::text = 'sent' and sent_at is not null and last_error_code is null)
  or (status::text = 'failed' and sent_at is null and last_error_code is not null)
  or (status::text in ('pending', 'canceled') and sent_at is null and last_error_code is null));

alter table notification_delivery_receipts drop constraint notification_delivery_receipts_completion_check;
alter table notification_delivery_receipts add constraint notification_delivery_receipts_completion_check check (
  (status::text in ('pending', 'retryable_failed') and completed_at is null)
  or (status::text in ('sent', 'invalid', 'permanent_failed', 'canceled') and completed_at is not null));

alter table outbox_events
  add column admin_retry_count integer not null default 0 check (admin_retry_count between 0 and 3),
  add column recovery_admin_id uuid references app_users(id) on delete restrict,
  add column recovery_reason text check (recovery_reason is null or length(recovery_reason) between 10 and 500),
  add column recovery_at timestamptz,
  add column abandoned_at timestamptz,
  add constraint outbox_abandoned_provenance_check check (
    (status::text = 'abandoned' and abandoned_at is not null and recovery_admin_id is not null and recovery_reason is not null)
    or (status::text <> 'abandoned' and abandoned_at is null));

create or replace function protect_outbox_domain_identity()
returns trigger language plpgsql as $$ begin
  if (new.topic, new.aggregate_type, new.aggregate_id, new.dedupe_key, new.payload, new.created_at)
    is distinct from (old.topic, old.aggregate_type, old.aggregate_id, old.dedupe_key, old.payload, old.created_at)
    or (old.status::text = 'abandoned' and new is distinct from old) then
    raise exception 'outbox domain identity or terminal abandonment is immutable' using errcode = '55000';
  end if;
  return new;
end $$;
create trigger outbox_domain_identity_guard before update on outbox_events for each row execute function protect_outbox_domain_identity();

create or replace function protect_canceled_notification()
returns trigger language plpgsql as $$ begin
  if old.status::text = 'canceled' and (new.status, new.sent_at, new.last_error_code, new.canceled_at, new.recovery_admin_id, new.recovery_reason)
    is distinct from (old.status, old.sent_at, old.last_error_code, old.canceled_at, old.recovery_admin_id, old.recovery_reason) then
    raise exception 'canceled delivery is terminal; inbox read state remains independent' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger notifications_canceled_guard before update on notifications for each row execute function protect_canceled_notification();

create index notifications_admin_page_idx on notifications (created_at desc, id desc);
create index outbox_admin_page_idx on outbox_events (created_at desc, id desc);
create index audit_admin_page_idx on audit_logs (created_at desc, id desc);
create index audit_admin_actions_page_idx on audit_logs (created_at desc, id desc) where actor_role = 'admin';
