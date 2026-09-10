do $$
begin
  create type reminder_occurrence_status as enum (
    'due', 'queued', 'sent', 'dismissed', 'failed'
  );
exception
  when duplicate_object then null;
end;
$$;

create table reminder_rules (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references app_users(id) on delete cascade,
  motorcycle_id uuid not null references motorcycles(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  interval_days integer check (interval_days is null or interval_days between 1 and 3650),
  next_due_at timestamptz not null,
  snoozed_until timestamptz,
  enabled boolean not null default true,
  last_completed_at timestamptz,
  lease_owner text,
  lease_expires_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at),
  check (snoozed_until is null or snoozed_until >= created_at),
  check (lease_expires_at is null or lease_owner is not null)
);

create index reminder_rules_rider_due_idx
  on reminder_rules (rider_id, enabled, coalesce(snoozed_until, next_due_at), id);

create index reminder_rules_due_worker_idx
  on reminder_rules (enabled, coalesce(snoozed_until, next_due_at), lease_expires_at, id)
  where enabled = true;

create table reminder_occurrences (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references reminder_rules(id) on delete cascade,
  rider_id uuid not null references app_users(id) on delete cascade,
  motorcycle_id uuid not null references motorcycles(id) on delete cascade,
  due_at timestamptz not null,
  status reminder_occurrence_status not null default 'due',
  notification_id uuid,
  retry_count integer not null default 0 check (retry_count >= 0),
  last_error_code text check (last_error_code is null or length(last_error_code) between 1 and 100),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (rule_id, due_at),
  check (processed_at is null or processed_at >= created_at)
);

create index reminder_occurrences_rider_status_due_idx
  on reminder_occurrences (rider_id, status, due_at desc);

create index reminder_occurrences_rule_status_due_idx
  on reminder_occurrences (rule_id, status, due_at desc);

create or replace function validate_reminder_rule_motorcycle_owner()
returns trigger
language plpgsql
as $$
declare
  motorcycle_owner uuid;
begin
  select rider_id into motorcycle_owner
    from motorcycles
    where id = new.motorcycle_id
      and archived_at is null;

  if not found then
    raise exception 'reminder motorcycle does not exist' using errcode = '23503';
  end if;

  if motorcycle_owner <> new.rider_id then
    raise exception 'reminder motorcycle owner mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger reminder_rules_motorcycle_owner_check
  before insert or update of rider_id, motorcycle_id
  on reminder_rules
  for each row
  execute function validate_reminder_rule_motorcycle_owner();

create or replace function validate_reminder_occurrence_identity()
returns trigger
language plpgsql
as $$
declare
  rule_record reminder_rules%rowtype;
begin
  select * into rule_record
    from reminder_rules
    where id = new.rule_id;

  if not found then
    raise exception 'reminder rule does not exist' using errcode = '23503';
  end if;

  if rule_record.rider_id <> new.rider_id
     or rule_record.motorcycle_id <> new.motorcycle_id then
    raise exception 'reminder occurrence identity mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger reminder_occurrences_identity_check
  before insert or update of rule_id, rider_id, motorcycle_id
  on reminder_occurrences
  for each row
  execute function validate_reminder_occurrence_identity();

alter table service_requests
  add column reminder_id uuid references reminder_rules(id) on delete restrict,
  add column reminder_context_id uuid references reminder_occurrences(id) on delete restrict;

create unique index service_requests_reminder_context_unique_idx
  on service_requests (reminder_context_id)
  where reminder_context_id is not null;

alter table service_requests
  add constraint service_requests_reminder_reference_pair_check
  check (
    (reminder_id is null and reminder_context_id is null)
    or (reminder_id is not null and reminder_context_id is not null)
  );

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'service_requests'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%periodic_maintenance%'
    and pg_get_constraintdef(oid) ilike '%scheduled_start_at is not null%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table service_requests drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table service_requests
  add constraint service_requests_periodic_maintenance_time_or_reminder_check
  check (
    service_type <> 'periodic_maintenance'
    or (
      scheduled_start_at is not null
      and scheduled_start_at > created_at
      and reminder_id is null
      and reminder_context_id is null
    )
    or (
      scheduled_start_at is null
      and reminder_id is not null
      and reminder_context_id is not null
    )
  );

create or replace function validate_service_request_reminder_identity()
returns trigger
language plpgsql
as $$
declare
  rule_record reminder_rules%rowtype;
  occurrence_record reminder_occurrences%rowtype;
begin
  if new.reminder_id is null and new.reminder_context_id is null then
    return new;
  end if;

  if new.service_type <> 'periodic_maintenance' then
    raise exception 'reminder references require periodic maintenance' using errcode = '23514';
  end if;

  select * into rule_record
    from reminder_rules
    where id = new.reminder_id;

  if not found then
    raise exception 'reminder rule does not exist' using errcode = '23503';
  end if;

  select * into occurrence_record
    from reminder_occurrences
    where id = new.reminder_context_id;

  if not found then
    raise exception 'reminder occurrence does not exist' using errcode = '23503';
  end if;

  if occurrence_record.rule_id <> rule_record.id
     or rule_record.rider_id <> new.rider_id
     or rule_record.motorcycle_id <> new.motorcycle_id
     or occurrence_record.rider_id <> new.rider_id
     or occurrence_record.motorcycle_id <> new.motorcycle_id then
    raise exception 'service request reminder identity mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger service_requests_reminder_identity_check
  before insert or update of reminder_id, reminder_context_id, rider_id, motorcycle_id, service_type
  on service_requests
  for each row
  execute function validate_service_request_reminder_identity();

alter table reminder_rules enable row level security;
alter table reminder_occurrences enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on reminder_rules, reminder_occurrences from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on reminder_rules, reminder_occurrences from authenticated;
    grant select on reminder_rules, reminder_occurrences to authenticated;
  end if;
end;
$$;

create policy reminder_rules_owner_select
  on reminder_rules
  for select
  using (rider_id = auth.uid());

create policy reminder_occurrences_owner_select
  on reminder_occurrences
  for select
  using (rider_id = auth.uid());
