create table user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  device_key_hash text not null check (length(device_key_hash) = 64),
  platform text not null check (length(platform) between 1 and 50),
  enabled boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_key_hash)
);

create index user_devices_user_enabled_idx
  on user_devices (user_id, enabled, updated_at desc);

alter table user_devices enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on user_devices from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on user_devices from authenticated;
  end if;
end;
$$;
