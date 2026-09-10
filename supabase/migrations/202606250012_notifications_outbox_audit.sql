do $$
begin
  create type notification_status as enum ('pending', 'sent', 'failed');
exception
  when duplicate_object then null;
end;
$$;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  type text not null check (length(type) between 1 and 100),
  title text not null check (length(title) between 1 and 200),
  body text not null check (length(body) between 1 and 2000),
  data jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique check (length(dedupe_key) between 1 and 300),
  status notification_status not null default 'pending',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error_code text check (
    last_error_code is null or length(last_error_code) between 1 and 100
  ),
  check (read_at is null or read_at >= created_at),
  check (sent_at is null or sent_at >= created_at),
  check (
    (status = 'sent' and sent_at is not null and last_error_code is null)
    or (status = 'failed' and sent_at is null and last_error_code is not null)
    or (status = 'pending' and sent_at is null and last_error_code is null)
  )
);

create index notifications_user_created_idx
  on notifications (user_id, created_at desc, id);
create index notifications_delivery_idx
  on notifications (status, created_at, id)
  where status in ('pending', 'failed');

alter table reminder_occurrences
  add constraint reminder_occurrences_notification_fk
  foreign key (notification_id) references notifications(id) on delete set null;

alter table outbox_events
  add constraint outbox_events_processing_lease_check
  check (
    (status = 'processing' and lease_owner is not null and lease_expires_at is not null)
    or (status <> 'processing' and lease_owner is null and lease_expires_at is null)
  ),
  add constraint outbox_events_processed_state_check
  check (
    (status = 'processed' and processed_at is not null)
    or (status <> 'processed' and processed_at is null)
  );

create or replace function contains_prohibited_metadata(value jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  entry record;
  item jsonb;
begin
  if jsonb_typeof(value) = 'object' then
    for entry in select key, val from jsonb_each(value) as fields(key, val)
    loop
      if entry.key ~* '(authorization|api[_-]?key|service[_-]?role|secret|password|credential|(^|[_-])token($|[_-])|raw[_-]?audio|audio[_-]?(data|bytes|content)|symptom[_-]?text|transcrib|chatbot[_-]?(text|message)|diagnosis[_-]?(text|body|content)|payment[_-]?(credential|card|cvv|bank)|card[_-]?(number|cvv)|bank[_-]?account)'
         or contains_prohibited_metadata(entry.val) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(value) = 'array' then
    for item in select element from jsonb_array_elements(value) as items(element)
    loop
      if contains_prohibited_metadata(item) then
        return true;
      end if;
    end loop;
  end if;
  return false;
end;
$$;

alter table notifications
  add constraint notifications_data_sanitized_check
  check (not contains_prohibited_metadata(data));
alter table outbox_events
  add constraint outbox_payload_sanitized_check
  check (not contains_prohibited_metadata(payload)) not valid;
alter table audit_logs
  add constraint audit_metadata_sanitized_check
  check (not contains_prohibited_metadata(metadata)) not valid;

drop trigger if exists audit_logs_reject_update_delete on audit_logs;
create trigger audit_logs_reject_update_delete
before update or delete on audit_logs
for each row execute function reject_audit_log_mutation();

create trigger audit_logs_reject_truncate
before truncate on audit_logs
for each statement execute function reject_audit_log_mutation();

alter table notifications enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on notifications from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on notifications from authenticated;
    grant select on notifications to authenticated;
  end if;
end;
$$;

create policy notifications_owner_select
  on notifications
  for select
  using (user_id = auth.uid());
