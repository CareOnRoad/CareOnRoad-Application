alter table idempotency_records enable row level security;
alter table outbox_events enable row level security;
alter table audit_logs enable row level security;

-- No direct-client policies are created. PostgreSQL therefore denies access to
-- non-owner roles by default while backend authorization remains authoritative.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on idempotency_records, outbox_events, audit_logs from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on idempotency_records, outbox_events, audit_logs from authenticated;
  end if;
end;
$$;
