alter table quotes drop constraint quotes_purpose_check;
alter table quotes add constraint quotes_purpose_check
  check (purpose in ('standard', 'rescue_labor', 'rescue_final', 'maintenance_labor', 'maintenance_work'));

alter table assignments
  add column maintenance_labor_quote_id uuid,
  add constraint assignments_maintenance_labor_identity_fk
    foreign key (maintenance_labor_quote_id, id, request_id) references quotes (id, assignment_id, request_id),
  add constraint assignments_one_service_agreement_check
    check (rescue_labor_quote_id is null or maintenance_labor_quote_id is null);

alter table assignment_completion_checklists
  add column approved_quote_id uuid,
  add constraint assignment_checklists_approved_quote_identity_fk
    foreign key (approved_quote_id, assignment_id, request_id) references quotes (id, assignment_id, request_id);

create function validate_maintenance_agreement() returns trigger language plpgsql as $$
begin
  if old.maintenance_labor_quote_id is not null and new.maintenance_labor_quote_id is distinct from old.maintenance_labor_quote_id then
    raise exception 'maintenance agreement is immutable' using errcode = '55000';
  end if;
  if new.maintenance_labor_quote_id is not null and not exists (
    select 1 from quotes q join service_requests r on r.id = q.request_id
    where q.id = new.maintenance_labor_quote_id and q.assignment_id = new.id
      and q.status = 'approved' and q.purpose = 'maintenance_labor'
      and q.total_amount > 0 and r.service_type = 'periodic_maintenance'
  ) then
    raise exception 'approved maintenance labor agreement is required' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger assignments_validate_maintenance_agreement
  before update of maintenance_labor_quote_id on assignments
  for each row execute function validate_maintenance_agreement();
