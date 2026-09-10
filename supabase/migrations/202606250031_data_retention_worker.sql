create table retention_worker_leases (
  worker_name text primary key check (worker_name = 'data_retention'),
  lease_owner text not null check (length(lease_owner) between 1 and 120),
  lease_expires_at timestamptz not null,
  updated_at timestamptz not null
);

create index media_upload_intents_retention_idx on media_upload_intents (updated_at, id) where status in ('expired', 'finalized');
create index device_delivery_credentials_retention_idx on device_delivery_credentials (disabled_at, id) where enabled = false and disabled_at is not null;
create index worker_run_records_retention_idx on worker_run_records (completed_at, id);

drop trigger worker_run_records_reject_update on worker_run_records;
create trigger worker_run_records_reject_update
  before update on worker_run_records
  for each row execute function reject_worker_run_mutation();

alter table retention_worker_leases enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on retention_worker_leases from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on retention_worker_leases from authenticated; end if;
end $$;
