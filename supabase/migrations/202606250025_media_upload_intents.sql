create table media_upload_intents (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references app_users(id) on delete restrict,
  actor_role text not null check (actor_role in ('rider', 'mechanic')),
  resource_type text not null check (resource_type in ('service_request', 'assignment')),
  request_id uuid not null references service_requests(id) on delete cascade,
  assignment_id uuid references assignments(id) on delete cascade,
  purpose text not null check (length(btrim(purpose)) between 1 and 50),
  storage_bucket text not null check (length(btrim(storage_bucket)) between 1 and 100),
  object_key text not null unique check (
    length(btrim(object_key)) between 1 and 500
    and object_key !~ '(^|/)\.\.(/|$)'
    and object_key !~ '^/'
  ),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 8388608),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'finalized', 'expired')),
  media_metadata_id uuid,
  finalized_response jsonb,
  expires_at timestamptz not null,
  finalized_at timestamptz,
  cleanup_lease_owner text,
  cleanup_lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assignment_id, request_id, actor_id)
    references assignments (id, request_id, mechanic_id)
    on delete cascade,
  check (
    (resource_type = 'service_request' and assignment_id is null and actor_role = 'rider')
    or (resource_type = 'assignment' and assignment_id is not null and actor_role = 'mechanic')
  ),
  check (
    (status = 'finalized' and media_metadata_id is not null and finalized_response is not null and finalized_at is not null)
    or (status <> 'finalized' and media_metadata_id is null and finalized_response is null and finalized_at is null)
  )
);

create index media_upload_intents_resource_quota_idx
  on media_upload_intents (resource_type, request_id, assignment_id, status, expires_at);

create index media_upload_intents_actor_created_idx
  on media_upload_intents (actor_id, created_at desc);

create index media_upload_intents_cleanup_idx
  on media_upload_intents (expires_at, id)
  where status = 'pending';

alter table media_upload_intents enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on media_upload_intents from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on media_upload_intents from authenticated;
  end if;
end;
$$;
