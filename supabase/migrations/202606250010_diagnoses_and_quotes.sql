do $$
begin
  create type quote_status as enum (
    'pending', 'approved', 'rejected', 'superseded', 'expired'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type quote_line_type as enum ('labor', 'part', 'other');
exception
  when duplicate_object then null;
end;
$$;

create table mechanic_diagnoses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references assignments(id) on delete cascade,
  request_id uuid not null references service_requests(id) on delete cascade,
  mechanic_id uuid not null references mechanic_profiles(user_id) on delete restrict,
  diagnosis_text text not null check (length(diagnosis_text) between 3 and 5000),
  recommended_work_text text
    check (recommended_work_text is null or length(recommended_work_text) between 1 and 5000),
  safety_notes text
    check (safety_notes is null or length(safety_notes) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at)
);

create or replace function validate_mechanic_diagnosis_identity()
returns trigger
language plpgsql
as $$
declare
  assignment_record assignments%rowtype;
begin
  select *
    into assignment_record
    from assignments
    where id = new.assignment_id;

  if not found then
    raise exception 'diagnosis assignment does not exist' using errcode = '23503';
  end if;

  if assignment_record.request_id <> new.request_id
     or assignment_record.mechanic_id <> new.mechanic_id then
    raise exception 'diagnosis assignment identity mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger mechanic_diagnoses_identity_check
  before insert or update of assignment_id, request_id, mechanic_id
  on mechanic_diagnoses
  for each row
  execute function validate_mechanic_diagnosis_identity();

create table quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  diagnosis_id uuid references mechanic_diagnoses(id) on delete restrict,
  version integer not null check (version >= 1),
  status quote_status not null default 'pending',
  currency text not null default 'VND' check (currency = 'VND'),
  subtotal_amount bigint not null check (subtotal_amount >= 0),
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  total_amount bigint not null check (
    total_amount >= 0
    and total_amount = subtotal_amount - discount_amount
  ),
  notes text check (notes is null or length(notes) between 1 and 2000),
  expires_at timestamptz,
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (request_id, version),
  check (responded_at is null or responded_at >= created_at)
);

create unique index quotes_one_pending_request_idx
  on quotes (request_id)
  where status = 'pending';

create index quotes_request_version_idx
  on quotes (request_id, version desc);

create index quotes_assignment_idx
  on quotes (assignment_id, created_at desc);

create index quotes_diagnosis_idx
  on quotes (diagnosis_id)
  where diagnosis_id is not null;

create table quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  line_type quote_line_type not null,
  description text not null check (length(description) between 1 and 500),
  quantity numeric(10,2) not null check (quantity > 0),
  unit_amount bigint not null check (unit_amount >= 0),
  line_total_amount bigint not null check (line_total_amount >= 0),
  sort_order smallint not null check (sort_order >= 0),
  unique (quote_id, sort_order)
);

create or replace function validate_quote_identity()
returns trigger
language plpgsql
as $$
declare
  assignment_record assignments%rowtype;
  diagnosis_record mechanic_diagnoses%rowtype;
begin
  select *
    into assignment_record
    from assignments
    where id = new.assignment_id;

  if not found then
    raise exception 'quote assignment does not exist' using errcode = '23503';
  end if;

  if assignment_record.request_id <> new.request_id then
    raise exception 'quote assignment request mismatch' using errcode = '23514';
  end if;

  if new.diagnosis_id is not null then
    select *
      into diagnosis_record
      from mechanic_diagnoses
      where id = new.diagnosis_id;

    if not found then
      raise exception 'quote diagnosis does not exist' using errcode = '23503';
    end if;

    if diagnosis_record.assignment_id <> new.assignment_id
       or diagnosis_record.request_id <> new.request_id then
      raise exception 'quote diagnosis identity mismatch' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger quotes_identity_check
  before insert or update of request_id, assignment_id, diagnosis_id
  on quotes
  for each row
  execute function validate_quote_identity();

create or replace function reject_referenced_diagnosis_update()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from quotes
    where diagnosis_id = old.id
  ) then
    raise exception 'diagnosis is immutable after quote reference'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger mechanic_diagnoses_reject_referenced_update
  before update
  on mechanic_diagnoses
  for each row
  execute function reject_referenced_diagnosis_update();

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
       and new.status in ('approved', 'rejected', 'superseded', 'expired')
     ) then
    raise exception 'quote status transition is not allowed' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger quotes_validate_update
  before update
  on quotes
  for each row
  execute function validate_quote_status_update();

create or replace function reject_immutable_row_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'immutable row cannot be updated or deleted' using errcode = '55000';
end;
$$;

create trigger quote_lines_reject_update_delete
  before update or delete
  on quote_lines
  for each row
  execute function reject_immutable_row_mutation();

create trigger quotes_reject_delete
  before delete
  on quotes
  for each row
  execute function reject_immutable_row_mutation();

alter table mechanic_diagnoses enable row level security;
alter table quotes enable row level security;
alter table quote_lines enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on mechanic_diagnoses, quotes, quote_lines from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on mechanic_diagnoses, quotes, quote_lines from authenticated;
    grant select on mechanic_diagnoses, quotes, quote_lines to authenticated;
  end if;
end;
$$;

create policy mechanic_diagnoses_mechanic_select
  on mechanic_diagnoses
  for select
  using (mechanic_id = auth.uid());

create policy mechanic_diagnoses_rider_select
  on mechanic_diagnoses
  for select
  using (
    exists (
      select 1
      from service_requests request
      where request.id = mechanic_diagnoses.request_id
        and request.rider_id = auth.uid()
    )
  );

create policy quotes_assignment_actor_select
  on quotes
  for select
  using (
    exists (
      select 1
      from assignments assignment
      join service_requests request on request.id = assignment.request_id
      where assignment.id = quotes.assignment_id
        and (
          assignment.mechanic_id = auth.uid()
          or request.rider_id = auth.uid()
        )
    )
  );

create policy quote_lines_assignment_actor_select
  on quote_lines
  for select
  using (
    exists (
      select 1
      from quotes quote
      join assignments assignment on assignment.id = quote.assignment_id
      join service_requests request on request.id = quote.request_id
      where quote.id = quote_lines.quote_id
        and (
          assignment.mechanic_id = auth.uid()
          or request.rider_id = auth.uid()
        )
    )
  );
