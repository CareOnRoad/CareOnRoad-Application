create table worker_run_records (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null check (length(worker_name) between 1 and 80),
  status text not null check (status in ('succeeded', 'failed')),
  error_code text check (error_code is null or error_code ~ '^[A-Z0-9_]{1,80}$'),
  items_claimed integer not null default 0 check (items_claimed >= 0),
  items_succeeded integer not null default 0 check (items_succeeded >= 0),
  items_failed integer not null default 0 check (items_failed >= 0),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (completed_at >= started_at)
);

create index worker_run_records_completed_idx
  on worker_run_records (completed_at desc, id desc);
create index worker_run_records_name_completed_idx
  on worker_run_records (worker_name, completed_at desc, id desc);
create index outbox_events_dead_letter_created_idx
  on outbox_events (created_at desc, id desc) where status = 'dead_letter';
create index payment_orders_needs_review_updated_idx
  on payment_orders (updated_at desc, id desc) where status = 'needs_review';
create index service_requests_dispatch_stuck_idx
  on service_requests (updated_at, id) where status in ('dispatching', 'offered');

create function reject_worker_run_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'worker run records are append-only' using errcode = '55000';
end;
$$;
create trigger worker_run_records_reject_update
  before update or delete on worker_run_records
  for each row execute function reject_worker_run_mutation();

alter table worker_run_records enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on worker_run_records from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on worker_run_records from authenticated;
  end if;
end;
$$;
