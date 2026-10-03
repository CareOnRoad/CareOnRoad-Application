-- Migration 040 must be committed first; content and published versions stay immutable.
create or replace function validate_quote_status_update()
returns trigger
language plpgsql
as $$
begin
  if new.request_id is distinct from old.request_id
     or new.assignment_id is distinct from old.assignment_id
     or new.diagnosis_id is distinct from old.diagnosis_id
     or new.version is distinct from old.version
     or new.currency is distinct from old.currency
     or new.subtotal_amount is distinct from old.subtotal_amount
     or new.discount_amount is distinct from old.discount_amount
     or new.total_amount is distinct from old.total_amount
     or new.notes is distinct from old.notes
     or new.expires_at is distinct from old.expires_at
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'quote content is immutable' using errcode = '55000';
  end if;

  if new.status is distinct from old.status
     and not (
       old.status = 'pending'
       and new.status::text in ('approved', 'rejected', 'superseded', 'expired', 'voided')
     ) then
    raise exception 'quote status transition is not allowed' using errcode = '23514';
  end if;

  return new;
end;
$$;


create table admin_supervision_actions (
  id uuid primary key,
  admin_id uuid not null references app_users(id) on delete restrict,
  request_id uuid not null references service_requests(id) on delete restrict,
  assignment_id uuid not null references assignments(id) on delete restrict,
  quote_id uuid references quotes(id) on delete restrict,
  diagnosis_id uuid references mechanic_diagnoses(id) on delete restrict,
  action text not null check (action in ('request_revision', 'void_pending_quote', 'expire_quote', 'uphold_latest_quote')),
  reason text not null check (length(reason) between 10 and 500),
  created_at timestamptz not null,
  check ((quote_id is not null and diagnosis_id is null) or (quote_id is null and diagnosis_id is not null and action = 'request_revision'))
);
create index admin_supervision_request_page_idx on admin_supervision_actions (request_id, created_at desc, id desc);
create index admin_supervision_quote_idx on admin_supervision_actions (quote_id, created_at desc);
create trigger admin_supervision_append_only before update or delete on admin_supervision_actions
  for each row execute function reject_immutable_row_mutation();
create trigger admin_supervision_reject_truncate before truncate on admin_supervision_actions
  for each statement execute function reject_immutable_row_mutation();
alter table admin_supervision_actions enable row level security;
revoke all on admin_supervision_actions from anon, authenticated;

create or replace function validate_admin_supervision_identity()
returns trigger language plpgsql as $$
begin
  if not exists(select 1 from app_users u join user_roles r on r.user_id = u.id
    where u.id = new.admin_id and u.status = 'active' and r.role = 'admin') then
    raise exception 'active supervisor required' using errcode = '23514';
  end if;
  if new.quote_id is not null then
    if not exists(select 1 from quotes q where q.id = new.quote_id and q.request_id = new.request_id and q.assignment_id = new.assignment_id) then
      raise exception 'supervision quote identity mismatch' using errcode = '23514';
    end if;
  elsif not exists(select 1 from mechanic_diagnoses d where d.id = new.diagnosis_id and d.request_id = new.request_id and d.assignment_id = new.assignment_id) then
    raise exception 'supervision diagnosis identity mismatch' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger admin_supervision_identity_check before insert on admin_supervision_actions
  for each row execute function validate_admin_supervision_identity();

create or replace function validate_supervised_quote_void()
returns trigger language plpgsql as $$
begin
  if new.status::text = 'voided' and old.status::text <> 'voided' and not exists (
    select 1 from admin_supervision_actions a where a.quote_id = new.id
      and a.action in ('void_pending_quote', 'request_revision')) then
    raise exception 'quote void requires supervision evidence' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger quotes_supervision_void_guard before update of status on quotes
  for each row execute function validate_supervised_quote_void();
