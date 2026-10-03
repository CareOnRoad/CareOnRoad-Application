alter table assignments
  alter column accepted_candidate_id drop not null,
  add column source text not null default 'offer',
  add column assigned_by_admin_id uuid references app_users(id) on delete restrict,
  add column supersedes_assignment_id uuid unique references assignments(id) on delete restrict,
  add column dispatch_distance_m integer check (dispatch_distance_m >= 0),
  add constraint assignments_source_check check (
    (source = 'offer' and accepted_candidate_id is not null and assigned_by_admin_id is null and supersedes_assignment_id is null)
    or (source in ('admin_manual', 'admin_reassignment') and accepted_candidate_id is null
      and assigned_by_admin_id is not null and dispatch_distance_m is not null
      and ((source = 'admin_manual' and supersedes_assignment_id is null)
        or (source = 'admin_reassignment' and supersedes_assignment_id is not null and supersedes_assignment_id <> id)))
  );

create or replace function validate_assignment_candidate_identity()
returns trigger language plpgsql as $$
declare candidate_record dispatch_candidates%rowtype; previous_record assignments%rowtype;
begin
  if tg_op = 'UPDATE' then
    if (new.request_id, new.mechanic_id, new.accepted_candidate_id, new.source,
        new.assigned_by_admin_id, new.supersedes_assignment_id, new.dispatch_distance_m)
       is distinct from (old.request_id, old.mechanic_id, old.accepted_candidate_id, old.source,
        old.assigned_by_admin_id, old.supersedes_assignment_id, old.dispatch_distance_m) then
      raise exception 'assignment provenance is immutable' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.source = 'offer' then
    select * into candidate_record from dispatch_candidates where id = new.accepted_candidate_id;
    if not found then raise exception 'accepted candidate does not exist' using errcode = '23503'; end if;
    if candidate_record.request_id <> new.request_id or candidate_record.mechanic_id <> new.mechanic_id
       or candidate_record.status <> 'accepted' then
      raise exception 'assignment candidate identity mismatch' using errcode = '23514';
    end if;
    if new.dispatch_distance_m is distinct from candidate_record.distance_m then
      -- Legacy inserts may omit the snapshot; the accepted offer is authoritative.
      new.dispatch_distance_m := candidate_record.distance_m;
    end if;
  else
    if not exists(select 1 from app_users u join user_roles r on r.user_id = u.id
       where u.id = new.assigned_by_admin_id and u.status = 'active' and r.role = 'admin') then
      raise exception 'active assignment administrator required' using errcode = '23514';
    end if;
    if new.source = 'admin_reassignment' then
      select * into previous_record from assignments where id = new.supersedes_assignment_id;
      if not found or previous_record.request_id <> new.request_id or previous_record.status <> 'recovery_canceled'
         or previous_record.mechanic_id = new.mechanic_id then
        raise exception 'invalid assignment replacement' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger assignments_candidate_identity_check on assignments;
create trigger assignments_candidate_identity_check before insert or update of
  request_id, mechanic_id, accepted_candidate_id, source, assigned_by_admin_id, supersedes_assignment_id, dispatch_distance_m
  on assignments for each row execute function validate_assignment_candidate_identity();
