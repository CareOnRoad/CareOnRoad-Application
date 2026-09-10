alter table dispatch_rounds
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists failure_count integer not null default 0;

alter table dispatch_rounds
  drop constraint if exists dispatch_rounds_lease_pair_check;

alter table dispatch_rounds
  add constraint dispatch_rounds_lease_pair_check check (
    (lease_owner is null and lease_expires_at is null)
    or (lease_owner is not null and lease_expires_at is not null)
  );

alter table dispatch_rounds
  drop constraint if exists dispatch_rounds_failure_count_check;

alter table dispatch_rounds
  add constraint dispatch_rounds_failure_count_check check (failure_count >= 0);

create index if not exists dispatch_rounds_due_claim_idx
  on dispatch_rounds (expires_at, lease_expires_at, id)
  where status = 'active';
