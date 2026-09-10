do $$
begin
  create type dispatch_round_status as enum ('active', 'accepted', 'expired', 'canceled');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type dispatch_candidate_status as enum (
    'pending',
    'offered',
    'accepted',
    'rejected',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end;
$$;

create table dispatch_rounds (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  round_number smallint not null check (round_number between 1 and 4),
  radius_m integer not null check (radius_m in (2000, 5000, 8000, 12000)),
  status dispatch_round_status not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  unique (request_id, round_number),
  check (expires_at > started_at),
  check (completed_at is null or completed_at >= started_at)
);

create unique index dispatch_rounds_one_active_request_idx
  on dispatch_rounds (request_id)
  where status = 'active';

create index dispatch_rounds_request_idx
  on dispatch_rounds (request_id, round_number);

create index dispatch_rounds_active_expiry_idx
  on dispatch_rounds (expires_at)
  where status = 'active';

create table dispatch_candidates (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references dispatch_rounds(id) on delete cascade,
  request_id uuid not null references service_requests(id) on delete cascade,
  mechanic_id uuid not null references mechanic_profiles(user_id) on delete cascade,
  rank smallint not null check (rank between 1 and 10),
  distance_m integer check (distance_m is null or distance_m >= 0),
  status dispatch_candidate_status not null default 'pending',
  offered_at timestamptz,
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, mechanic_id),
  unique (request_id, mechanic_id),
  check (
    (status = 'pending' and offered_at is null and expires_at is null)
    or (status <> 'pending' and offered_at is not null and expires_at is not null)
  ),
  check (expires_at is null or offered_at is null or expires_at > offered_at),
  check (responded_at is null or offered_at is null or responded_at >= offered_at)
);

create index dispatch_candidates_mechanic_open_idx
  on dispatch_candidates (mechanic_id, expires_at)
  where status = 'offered';

create index dispatch_candidates_request_status_idx
  on dispatch_candidates (request_id, status, rank);

create index dispatch_candidates_round_rank_idx
  on dispatch_candidates (round_id, rank);

alter table dispatch_rounds enable row level security;
alter table dispatch_candidates enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on dispatch_rounds, dispatch_candidates from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on dispatch_rounds, dispatch_candidates from authenticated;
    grant select on dispatch_rounds, dispatch_candidates to authenticated;
  end if;
end;
$$;

create policy dispatch_candidates_mechanic_select
  on dispatch_candidates
  for select
  using (mechanic_id = auth.uid());

create policy dispatch_rounds_mechanic_select
  on dispatch_rounds
  for select
  using (
    exists (
      select 1
      from dispatch_candidates candidate
      where candidate.round_id = dispatch_rounds.id
        and candidate.mechanic_id = auth.uid()
    )
  );
