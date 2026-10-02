create function valid_dispatch_config_value(key text, value jsonb)
returns boolean language plpgsql immutable as $$
declare item jsonb; previous numeric := 0; amount numeric;
begin
  if key='dispatch.radius_steps_km' then
    if jsonb_typeof(value)<>'array' or jsonb_array_length(value) not between 1 and 8 then return false; end if;
    for item in select * from jsonb_array_elements(value) loop
      if jsonb_typeof(item)<>'number' then return false; end if;
      amount := item::text::numeric;
      if amount < 1 or amount > 100 or amount <= previous then return false; end if;
      previous := amount;
    end loop; return true;
  end if;
  if jsonb_typeof(value)<>'number' then return false; end if;
  amount := value::text::numeric;
  if trunc(amount)<>amount then return false; end if;
  return case key when 'dispatch.offer_expiry_seconds' then amount between 30 and 300
    when 'dispatch.max_rounds' then amount between 1 and 8
    when 'dispatch.total_wait_seconds' then amount between 60 and 1800 else false end;
end $$;
create table admin_operation_configs (
  config_key text primary key,
  value_json jsonb not null,
  version integer not null check(version>0),
  updated_by uuid not null references app_users(id) on delete restrict,
  updated_at timestamptz not null,
  reason text not null check(length(reason) between 10 and 500),
  constraint admin_operation_configs_value_check check(valid_dispatch_config_value(config_key,value_json))
);
create table admin_operation_config_versions (
  id uuid primary key default gen_random_uuid(),
  config_key text not null references admin_operation_configs(config_key) on delete restrict,
  version integer not null check(version>0),
  previous_value_json jsonb,
  new_value_json jsonb not null check(valid_dispatch_config_value(config_key,new_value_json)),
  updated_by uuid not null references app_users(id) on delete restrict,
  reason text not null check(length(reason) between 10 and 500),
  created_at timestamptz not null,
  unique(config_key,version)
);
create function record_dispatch_config_version() returns trigger language plpgsql as $$ begin
  perform pg_advisory_xact_lock(hashtext(current_schema() || ':dispatch_configuration'));
  if tg_op='UPDATE' and (new.config_key<>old.config_key or new.version<>old.version+1) then
    raise exception 'configuration version must advance once' using errcode='23514';
  elsif tg_op='INSERT' and new.version<>1 then raise exception 'configuration begins at version one' using errcode='23514'; end if;
  if not exists(select 1 from app_users u join user_roles r on r.user_id=u.id where u.id=new.updated_by and u.status='active' and r.role='admin') then
    raise exception 'active configuration administrator required' using errcode='23514'; end if;
  insert into admin_operation_config_versions(config_key,version,previous_value_json,new_value_json,updated_by,reason,created_at)
    values(new.config_key,new.version,case when tg_op='UPDATE' then old.value_json else null end,new.value_json,new.updated_by,new.reason,new.updated_at);
  return new;
end $$;
create trigger admin_operation_configs_version_guard after insert or update on admin_operation_configs for each row execute function record_dispatch_config_version();
create function validate_dispatch_config_budget() returns trigger language plpgsql as $$
declare expiry integer; budget integer;
begin
  select coalesce((select value_json::text::integer from admin_operation_configs where config_key='dispatch.offer_expiry_seconds'),60) into expiry;
  select coalesce((select value_json::text::integer from admin_operation_configs where config_key='dispatch.total_wait_seconds'),360) into budget;
  if budget<expiry then raise exception 'dispatch wait must cover offer expiry' using errcode='23514'; end if;return null;
end $$;
create constraint trigger admin_operation_configs_budget_guard after insert or update on admin_operation_configs deferrable initially deferred for each row execute function validate_dispatch_config_budget();
create trigger admin_operation_configs_reject_delete before delete on admin_operation_configs for each row execute function reject_admin_internal_note_mutation();
create trigger admin_operation_configs_reject_truncate before truncate on admin_operation_configs for each statement execute function reject_admin_internal_note_mutation();
create trigger admin_operation_config_versions_append_only before update or delete on admin_operation_config_versions for each row execute function reject_admin_internal_note_mutation();
create trigger admin_operation_config_versions_reject_truncate before truncate on admin_operation_config_versions for each statement execute function reject_admin_internal_note_mutation();
alter table admin_operation_configs enable row level security;
alter table admin_operation_config_versions enable row level security;
revoke all on admin_operation_configs,admin_operation_config_versions from anon,authenticated;

alter table dispatch_rounds add column policy_snapshot jsonb;
create function validate_dispatch_policy_snapshot() returns trigger language plpgsql as $$
declare key text;value jsonb;
begin
  if tg_op='UPDATE' and new.policy_snapshot is distinct from old.policy_snapshot then raise exception 'dispatch policy snapshot is immutable' using errcode='23514';end if;
  if new.policy_snapshot is not null then
    if jsonb_typeof(new.policy_snapshot)<>'object' then raise exception 'invalid dispatch policy snapshot' using errcode='23514';end if;
    if (select count(*) from jsonb_object_keys(new.policy_snapshot))<>4 then raise exception 'invalid dispatch policy snapshot' using errcode='23514';end if;
    for key,value in select * from jsonb_each(new.policy_snapshot) loop
      if not valid_dispatch_config_value(key,value) then raise exception 'invalid dispatch policy snapshot value' using errcode='23514';end if;
    end loop;
    if (new.policy_snapshot->>'dispatch.total_wait_seconds')::int < (new.policy_snapshot->>'dispatch.offer_expiry_seconds')::int then raise exception 'invalid dispatch policy budget' using errcode='23514';end if;
  end if;return new;
end $$;
create trigger dispatch_rounds_policy_guard before insert or update of policy_snapshot on dispatch_rounds for each row execute function validate_dispatch_policy_snapshot();
