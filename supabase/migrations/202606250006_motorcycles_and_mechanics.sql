do $$
begin
  create type service_type as enum (
    'emergency_rescue',
    'mobile_repair',
    'at_home_service',
    'periodic_maintenance',
    'other'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type mechanic_profile_status as enum ('pending', 'active', 'suspended', 'banned');
exception
  when duplicate_object then null;
end;
$$;

create table motorcycles (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references app_users(id) on delete cascade,
  brand_text text not null check (length(brand_text) between 1 and 100),
  model_text text not null check (length(model_text) between 1 and 100),
  license_plate text check (license_plate is null or length(license_plate) between 1 and 30),
  year smallint check (year is null or year between 1950 and 2100),
  notes text check (notes is null or length(notes) between 1 and 1000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index motorcycles_rider_active_idx
  on motorcycles (rider_id, created_at desc)
  where archived_at is null;

create table mechanic_profiles (
  user_id uuid primary key references app_users(id) on delete cascade,
  profile_status mechanic_profile_status not null default 'pending',
  is_available boolean not null default false,
  service_radius_km numeric(6,2) not null
    check (service_radius_km > 0 and service_radius_km <= 100),
  latest_location geography(Point, 4326),
  location_updated_at timestamptz,
  availability_updated_at timestamptz not null default now(),
  rating_avg numeric(3,2) not null default 0 check (rating_avg >= 0 and rating_avg <= 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (latest_location is null and location_updated_at is null)
    or (latest_location is not null and location_updated_at is not null)
  )
);

create index mechanic_profiles_available_location_idx
  on mechanic_profiles using gist (latest_location)
  where is_available = true and profile_status = 'active' and latest_location is not null;

create table mechanic_skills (
  mechanic_id uuid not null references mechanic_profiles(user_id) on delete cascade,
  service_type service_type not null,
  created_at timestamptz not null default now(),
  primary key (mechanic_id, service_type)
);

create index mechanic_skills_service_type_idx
  on mechanic_skills (service_type, mechanic_id);

create or replace function enforce_mechanic_profile_role()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from user_roles
    where user_id = new.user_id
      and role = 'mechanic'
  ) then
    raise exception 'mechanic profile requires mechanic role'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger mechanic_profiles_require_mechanic_role
  before insert or update on mechanic_profiles
  for each row execute function enforce_mechanic_profile_role();

alter table motorcycles enable row level security;
alter table mechanic_profiles enable row level security;
alter table mechanic_skills enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on motorcycles, mechanic_profiles, mechanic_skills from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on motorcycles, mechanic_profiles, mechanic_skills from authenticated;
  end if;
end;
$$;
