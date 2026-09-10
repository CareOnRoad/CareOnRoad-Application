alter table assignments
  add constraint assignments_id_mechanic_unique unique (id, mechanic_id);

create table assignment_live_locations (
  assignment_id uuid primary key references assignments(id) on delete cascade,
  mechanic_id uuid not null references mechanic_profiles(user_id) on delete cascade,
  location geography(Point, 4326) not null,
  observed_at timestamptz not null,
  accuracy_meters numeric(6,2) not null
    check (accuracy_meters >= 0 and accuracy_meters <= 100),
  received_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_live_locations_assignment_mechanic_fk
    foreign key (assignment_id, mechanic_id)
    references assignments(id, mechanic_id)
    on delete cascade,
  check (expires_at > received_at)
);

create index assignment_live_locations_expiry_idx
  on assignment_live_locations (expires_at, assignment_id);

create or replace function validate_assignment_live_location()
returns trigger
language plpgsql
as $$
declare
  assignment_row record;
begin
  select mechanic_id, status
  into assignment_row
  from assignments
  where id = new.assignment_id
  for key share;

  if not found then
    raise exception 'LIVE_TRACKING_ASSIGNMENT_NOT_FOUND' using errcode = '23503';
  end if;
  if assignment_row.mechanic_id <> new.mechanic_id then
    raise exception 'LIVE_TRACKING_MECHANIC_MISMATCH' using errcode = '23514';
  end if;
  if assignment_row.status not in ('accepted', 'en_route') then
    raise exception 'LIVE_TRACKING_ASSIGNMENT_INELIGIBLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger assignment_live_locations_validate_assignment
before insert or update on assignment_live_locations
for each row execute function validate_assignment_live_location();

create or replace function purge_assignment_live_location_on_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('accepted', 'en_route') then
    delete from assignment_live_locations where assignment_id = new.id;
  end if;
  return new;
end;
$$;

create trigger assignments_purge_live_location_on_status_change
after update of status on assignments
for each row
when (old.status is distinct from new.status)
execute function purge_assignment_live_location_on_status_change();

alter table assignment_live_locations enable row level security;

revoke all on assignment_live_locations from anon, authenticated;
