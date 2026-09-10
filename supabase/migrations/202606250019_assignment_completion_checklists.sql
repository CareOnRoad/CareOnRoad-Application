create table assignment_completion_checklists (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  request_id uuid not null,
  mechanic_id uuid not null,
  revision integer not null check (revision >= 1),
  work_summary text not null check (length(btrim(work_summary)) between 10 and 3000),
  safety_checklist jsonb not null check (
    jsonb_typeof(safety_checklist) = 'object'
    and safety_checklist ? 'test_ride_completed'
    and safety_checklist ? 'tools_removed'
    and safety_checklist ? 'area_safe'
    and safety_checklist ? 'rider_briefed'
    and safety_checklist ? 'no_fluid_leak'
  ),
  notes text check (notes is null or length(btrim(notes)) between 1 and 1000),
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, request_id, mechanic_id)
    references assignments (id, request_id, mechanic_id)
    on delete cascade,
  unique (assignment_id, revision),
  check (created_by = mechanic_id)
);

create index assignment_completion_checklists_assignment_revision_idx
  on assignment_completion_checklists (assignment_id, revision desc, created_at desc, id desc);

create index assignment_completion_checklists_mechanic_created_idx
  on assignment_completion_checklists (mechanic_id, created_at desc, id desc);

alter table assignment_completion_checklists enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on assignment_completion_checklists from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on assignment_completion_checklists from authenticated;
    grant select on assignment_completion_checklists to authenticated;
  end if;
end;
$$;

create policy assignment_completion_checklists_mechanic_select
  on assignment_completion_checklists
  for select
  using (mechanic_id = auth.uid());

create policy assignment_completion_checklists_rider_select
  on assignment_completion_checklists
  for select
  using (
    exists (
      select 1
      from service_requests request
      where request.id = assignment_completion_checklists.request_id
        and request.rider_id = auth.uid()
    )
  );
