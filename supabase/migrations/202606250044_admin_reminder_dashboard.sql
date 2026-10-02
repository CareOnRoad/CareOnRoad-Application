create index reminder_rules_admin_page_idx on reminder_rules (created_at desc, id desc);
create index reminder_occurrences_admin_page_idx on reminder_occurrences (rule_id, created_at desc, id desc);
create index reminder_rules_failures_idx on reminder_rules (updated_at desc, id desc) where failure_count >= 3;
create index assignments_operations_idx on assignments (updated_at desc, id desc) where status in ('accepted','en_route','on_site','diagnosis','quoted','awaiting_payment','in_progress');

create or replace function validate_enabled_reminder_owner()
returns trigger language plpgsql as $$ begin
  if new.enabled and not exists(select 1 from motorcycles m join app_users u on u.id=m.rider_id
    join user_roles role on role.user_id=u.id and role.role='rider'
    where m.id=new.motorcycle_id and m.rider_id=new.rider_id and m.archived_at is null and u.status='active') then
    raise exception 'enabled reminder requires an active rider and motorcycle' using errcode='23514';
  end if;
  return new;
end $$;
create trigger reminder_rules_owner_guard before insert or update of enabled,rider_id,motorcycle_id on reminder_rules
  for each row execute function validate_enabled_reminder_owner();
