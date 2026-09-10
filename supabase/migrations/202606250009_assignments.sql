do $$
begin
  create type assignment_status as enum (
    'accepted',
    'en_route',
    'on_site',
    'diagnosis',
    'quoted',
    'awaiting_payment',
    'in_progress',
    'completed',
    'canceled'
  );
exception
  when duplicate_object then null;
end;
$$;

create table assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  mechanic_id uuid not null references mechanic_profiles(user_id) on delete restrict,
  accepted_candidate_id uuid not null references dispatch_candidates(id) on delete restrict,
  status assignment_status not null default 'accepted',
  accepted_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (accepted_candidate_id),
  check (updated_at >= created_at),
  check (accepted_at >= created_at),
  check (started_at is null or started_at >= accepted_at),
  check (completed_at is null or completed_at >= accepted_at),
  check (canceled_at is null or canceled_at >= accepted_at),
  check (
    (status = 'completed' and completed_at is not null and canceled_at is null)
    or status <> 'completed'
  ),
  check (
    (status = 'canceled' and canceled_at is not null and completed_at is null)
    or status <> 'canceled'
  )
);

create unique index assignments_one_active_request_idx
  on assignments (request_id)
  where status in (
    'accepted',
    'en_route',
    'on_site',
    'diagnosis',
    'quoted',
    'awaiting_payment',
    'in_progress'
  );

create unique index assignments_one_active_mechanic_idx
  on assignments (mechanic_id)
  where status in (
    'accepted',
    'en_route',
    'on_site',
    'diagnosis',
    'quoted',
    'awaiting_payment',
    'in_progress'
  );

create index assignments_mechanic_status_idx
  on assignments (mechanic_id, status, created_at desc);

create index assignments_request_status_idx
  on assignments (request_id, status, created_at desc);

create index assignments_candidate_idx
  on assignments (accepted_candidate_id);

create or replace function validate_assignment_candidate_identity()
returns trigger
language plpgsql
as $$
declare
  candidate_record dispatch_candidates%rowtype;
begin
  select *
    into candidate_record
    from dispatch_candidates
    where id = new.accepted_candidate_id;

  if not found then
    raise exception 'accepted candidate does not exist'
      using errcode = '23503';
  end if;

  if candidate_record.request_id <> new.request_id
     or candidate_record.mechanic_id <> new.mechanic_id then
    raise exception 'assignment candidate identity mismatch'
      using errcode = '23514';
  end if;

  if candidate_record.status <> 'accepted' then
    raise exception 'assignment candidate must be accepted'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger assignments_candidate_identity_check
  before insert or update of request_id, mechanic_id, accepted_candidate_id
  on assignments
  for each row
  execute function validate_assignment_candidate_identity();

create table assignment_status_history (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  from_status assignment_status,
  to_status assignment_status not null,
  actor_id uuid references app_users(id) on delete set null,
  actor_role app_role,
  reason text check (reason is null or length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  check (
    (from_status is null and to_status = 'accepted')
    or from_status is not null
  ),
  check (from_status is null or from_status <> to_status)
);

create index assignment_status_history_assignment_idx
  on assignment_status_history (assignment_id, created_at desc);

alter table assignments enable row level security;
alter table assignment_status_history enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on assignments, assignment_status_history from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on assignments, assignment_status_history from authenticated;
    grant select on assignments, assignment_status_history to authenticated;
  end if;
end;
$$;

create policy assignments_mechanic_select
  on assignments
  for select
  using (mechanic_id = auth.uid());

create policy assignments_rider_select
  on assignments
  for select
  using (
    exists (
      select 1
      from service_requests request
      where request.id = assignments.request_id
        and request.rider_id = auth.uid()
    )
  );

create policy assignment_status_history_mechanic_select
  on assignment_status_history
  for select
  using (
    exists (
      select 1
      from assignments assignment
      where assignment.id = assignment_status_history.assignment_id
        and assignment.mechanic_id = auth.uid()
    )
  );

create policy assignment_status_history_rider_select
  on assignment_status_history
  for select
  using (
    exists (
      select 1
      from assignments assignment
      join service_requests request on request.id = assignment.request_id
      where assignment.id = assignment_status_history.assignment_id
        and request.rider_id = auth.uid()
    )
  );
