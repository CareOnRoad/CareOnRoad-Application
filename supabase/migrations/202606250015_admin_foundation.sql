-- Feature 003, Patch A: shared admin operation metadata and append-only
-- internal notes. Domain-specific admin commands are introduced by later
-- reviewable patches.

alter table audit_logs
  add column admin_reason text
  check (
    admin_reason is null
    or length(btrim(admin_reason)) between 10 and 500
  );

create index audit_logs_admin_activity_idx
  on audit_logs (actor_role, created_at desc, id desc)
  where actor_role = 'admin';

create table admin_internal_notes (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references app_users(id) on delete restrict,
  service_request_id uuid references service_requests(id) on delete restrict,
  assignment_id uuid references assignments(id) on delete restrict,
  note_text text not null check (length(btrim(note_text)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(service_request_id, assignment_id) = 1)
);

create index admin_internal_notes_request_created_idx
  on admin_internal_notes (service_request_id, created_at desc, id desc)
  where service_request_id is not null;

create index admin_internal_notes_assignment_created_idx
  on admin_internal_notes (assignment_id, created_at desc, id desc)
  where assignment_id is not null;

create index admin_internal_notes_admin_created_idx
  on admin_internal_notes (admin_id, created_at desc, id desc);

create function reject_admin_internal_note_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_internal_notes is append-only' using errcode = '55000';
end;
$$;

create trigger admin_internal_notes_reject_update_delete
before update or delete on admin_internal_notes
for each row execute function reject_admin_internal_note_mutation();

create trigger admin_internal_notes_reject_truncate
before truncate on admin_internal_notes
for each statement execute function reject_admin_internal_note_mutation();

alter table admin_internal_notes enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on admin_internal_notes from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on admin_internal_notes from authenticated;
  end if;
end;
$$;
