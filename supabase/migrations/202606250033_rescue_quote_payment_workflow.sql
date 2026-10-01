alter table quotes
  add column purpose text not null default 'standard'
    check (purpose in ('standard', 'rescue_labor', 'rescue_final')),
  add column labor_pricing jsonb,
  add constraint quotes_labor_pricing_check check (
    (purpose = 'rescue_labor' and labor_pricing is not null and jsonb_typeof(labor_pricing) = 'object' and total_amount > 0)
    or (purpose <> 'rescue_labor' and labor_pricing is null)
  ),
  add constraint quotes_assignment_identity_unique unique (id, assignment_id, request_id);

alter table assignments
  add column rescue_labor_quote_id uuid,
  add column rescue_payment_timing text check (rescue_payment_timing in ('labor_upfront', 'after_repair')),
  add constraint assignments_rescue_agreement_check check (
    (rescue_labor_quote_id is null) = (rescue_payment_timing is null)
  ),
  add constraint assignments_rescue_labor_identity_fk
    foreign key (rescue_labor_quote_id, id, request_id) references quotes (id, assignment_id, request_id);

create function protect_rescue_quote_fields() returns trigger language plpgsql as $$
begin
  if new.purpose is distinct from old.purpose or new.labor_pricing is distinct from old.labor_pricing then
    raise exception 'rescue quote content is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger quotes_protect_rescue_fields before update on quotes
  for each row execute function protect_rescue_quote_fields();

create function validate_rescue_agreement() returns trigger language plpgsql as $$
begin
  if old.rescue_labor_quote_id is not null and (
    new.rescue_labor_quote_id is distinct from old.rescue_labor_quote_id
    or new.rescue_payment_timing is distinct from old.rescue_payment_timing
  ) then
    raise exception 'rescue agreement is immutable' using errcode = '55000';
  end if;
  if new.rescue_labor_quote_id is not null and not exists (
    select 1 from quotes q join service_requests r on r.id = q.request_id
    where q.id = new.rescue_labor_quote_id and q.assignment_id = new.id
      and q.status = 'approved' and q.purpose = 'rescue_labor' and r.service_type = 'emergency_rescue'
  ) then
    raise exception 'approved rescue labor agreement is required' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger assignments_validate_rescue_agreement
  before update of rescue_labor_quote_id, rescue_payment_timing on assignments
  for each row execute function validate_rescue_agreement();

-- A new invitation preserves the old rejected/cancelled candidate and assignment.
alter table dispatch_candidates drop constraint dispatch_candidates_request_id_mechanic_id_key;
create index dispatch_candidates_request_mechanic_history_idx on dispatch_candidates (request_id, mechanic_id, created_at desc);
alter table dispatch_rounds drop constraint dispatch_rounds_round_number_check;
alter table dispatch_rounds add constraint dispatch_rounds_round_number_check check (round_number between 1 and 32767);

create unique index payment_orders_one_succeeded_quote_idx on payment_orders (quote_id) where status = 'succeeded';
