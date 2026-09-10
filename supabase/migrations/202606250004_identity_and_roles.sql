create type user_status as enum ('active', 'suspended', 'archived');
create type app_role as enum ('rider', 'mechanic', 'admin');

create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or length(display_name) between 1 and 120),
  phone_masked text,
  status user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_roles (
  user_id uuid not null references app_users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index user_roles_role_user_idx on user_roles (role, user_id);

alter table app_users enable row level security;
alter table user_roles enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on app_users, user_roles from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on app_users, user_roles from authenticated;
  end if;
end;
$$;
