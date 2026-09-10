create table assignment_media_metadata (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  request_id uuid not null,
  mechanic_id uuid not null,
  purpose text not null check (
    purpose in ('diagnosis', 'work_proof', 'safety', 'other')
  ),
  media_reference text not null check (
    length(btrim(media_reference)) between 1 and 1000
    and media_reference !~* '^data:'
    and media_reference !~* ';base64,'
  ),
  content_type text not null check (length(btrim(content_type)) between 1 and 200),
  size_bytes bigint not null check (size_bytes between 1 and 25000000),
  checksum text check (
    checksum is null or length(btrim(checksum)) between 1 and 200
  ),
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, request_id, mechanic_id)
    references assignments (id, request_id, mechanic_id)
    on delete cascade,
  unique (assignment_id, media_reference),
  check (created_by = mechanic_id)
);

create index assignment_media_metadata_assignment_created_idx
  on assignment_media_metadata (assignment_id, created_at desc, id desc);

create index assignment_media_metadata_mechanic_created_idx
  on assignment_media_metadata (mechanic_id, created_at desc, id desc);

alter table assignment_media_metadata enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on assignment_media_metadata from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on assignment_media_metadata from authenticated;
    grant select on assignment_media_metadata to authenticated;
  end if;
end;
$$;

create policy assignment_media_metadata_mechanic_select
  on assignment_media_metadata
  for select
  using (mechanic_id = auth.uid());

create policy assignment_media_metadata_rider_select
  on assignment_media_metadata
  for select
  using (
    exists (
      select 1
      from service_requests request
      where request.id = assignment_media_metadata.request_id
        and request.rider_id = auth.uid()
    )
  );
