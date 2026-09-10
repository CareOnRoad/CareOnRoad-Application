create table assignment_eta_metadata (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  request_id uuid not null,
  mechanic_id uuid not null,
  eta_at timestamptz,
  delay_reason text check (
    delay_reason is null or length(btrim(delay_reason)) between 1 and 500
  ),
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, request_id, mechanic_id)
    references assignments (id, request_id, mechanic_id)
    on delete cascade,
  check (eta_at is not null or delay_reason is not null),
  check (eta_at is null or eta_at > created_at),
  check (created_by = mechanic_id)
);

create index assignment_eta_metadata_assignment_created_idx
  on assignment_eta_metadata (assignment_id, created_at desc, id desc);

create index assignment_eta_metadata_mechanic_created_idx
  on assignment_eta_metadata (mechanic_id, created_at desc, id desc);

alter table assignment_eta_metadata enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on assignment_eta_metadata from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on assignment_eta_metadata from authenticated;
    grant select on assignment_eta_metadata to authenticated;
  end if;
end;
$$;

create policy assignment_eta_metadata_mechanic_select
  on assignment_eta_metadata
  for select
  using (mechanic_id = auth.uid());

create policy assignment_eta_metadata_rider_select
  on assignment_eta_metadata
  for select
  using (
    exists (
      select 1
      from service_requests request
      where request.id = assignment_eta_metadata.request_id
        and request.rider_id = auth.uid()
    )
  );
