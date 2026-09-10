create type outbox_status as enum ('pending', 'processing', 'processed', 'dead_letter');

create table idempotency_records (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  scope text not null check (length(scope) between 1 and 200),
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  request_hash text not null check (length(request_hash) = 64),
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (actor_id, scope, idempotency_key),
  check (
    (completed_at is null and response_status is null)
    or (completed_at is not null and response_status is not null)
  )
);

create table outbox_events (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (length(topic) between 1 and 200),
  aggregate_type text not null check (length(aggregate_type) between 1 and 100),
  aggregate_id uuid not null,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status outbox_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  check (
    (lease_owner is null and lease_expires_at is null)
    or (lease_owner is not null and lease_expires_at is not null)
  )
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text check (actor_role is null or actor_role in ('rider', 'mechanic', 'admin')),
  action text not null check (length(action) between 1 and 200),
  entity_type text not null check (length(entity_type) between 1 and 100),
  entity_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idempotency_records_expires_at_idx
  on idempotency_records (expires_at);
create index outbox_events_claim_idx
  on outbox_events (status, next_attempt_at, lease_expires_at);
create index outbox_events_aggregate_idx
  on outbox_events (aggregate_type, aggregate_id);
create index audit_logs_entity_created_idx
  on audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_created_idx
  on audit_logs (actor_id, created_at desc);

create function reject_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '55000';
end;
$$;

create trigger audit_logs_reject_update_delete
before update or delete on audit_logs
for each row execute function reject_audit_log_mutation();
