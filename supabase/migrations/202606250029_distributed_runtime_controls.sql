create table runtime_rate_limit_buckets (
  bucket_key_hash text primary key check (bucket_key_hash ~ '^[a-f0-9]{64}$'),
  scope text not null check (scope in ('session', 'ip', 'voice_session', 'transcription_session')),
  request_count integer not null check (request_count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null
);

create index runtime_rate_limit_buckets_expiry_idx on runtime_rate_limit_buckets (reset_at);

create table provider_circuit_states (
  provider_name text primary key check (length(provider_name) between 1 and 80),
  failure_count integer not null check (failure_count >= 0),
  open_until timestamptz,
  updated_at timestamptz not null
);

create index provider_circuit_states_expiry_idx on provider_circuit_states (open_until) where open_until is not null;

create function consume_runtime_rate_limit_bucket(
  p_key_hash text, p_scope text, p_limit integer, p_window_ms integer, p_now timestamptz
) returns table(request_count integer, reset_at timestamptz)
language plpgsql security invoker as $$
begin
  return query
  insert into runtime_rate_limit_buckets as bucket (bucket_key_hash, scope, request_count, reset_at, updated_at)
  values (p_key_hash, p_scope, 1, p_now + make_interval(secs => p_window_ms::double precision / 1000), p_now)
  on conflict (bucket_key_hash) do update set
    scope = excluded.scope,
    request_count = case when bucket.reset_at <= p_now then 1 else bucket.request_count + 1 end,
    reset_at = case when bucket.reset_at <= p_now then excluded.reset_at else bucket.reset_at end,
    updated_at = p_now
  returning bucket.request_count, bucket.reset_at;
end;
$$;

create function record_provider_circuit_failure(
  p_provider_name text, p_threshold integer, p_cooldown_ms integer, p_now timestamptz
) returns table(failure_count integer, open_until timestamptz)
language plpgsql security invoker as $$
begin
  return query
  insert into provider_circuit_states as state (provider_name, failure_count, open_until, updated_at)
  values (p_provider_name, 1, case when p_threshold <= 1 then p_now + make_interval(secs => p_cooldown_ms::double precision / 1000) end, p_now)
  on conflict (provider_name) do update set
    failure_count = case when state.open_until is not null and state.open_until <= p_now then 1 else state.failure_count + 1 end,
    open_until = case
      when (case when state.open_until is not null and state.open_until <= p_now then 1 else state.failure_count + 1 end) >= p_threshold
      then p_now + make_interval(secs => p_cooldown_ms::double precision / 1000)
      else null
    end,
    updated_at = p_now
  returning state.failure_count, state.open_until;
end;
$$;

create function cleanup_runtime_control_state(p_now timestamptz, p_limit integer)
returns integer language plpgsql security invoker as $$
declare deleted_count integer;
begin
  with expired as (
    select bucket_key_hash from runtime_rate_limit_buckets where reset_at <= p_now order by reset_at limit least(greatest(p_limit, 1), 100)
  ) delete from runtime_rate_limit_buckets where bucket_key_hash in (select bucket_key_hash from expired);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

alter table runtime_rate_limit_buckets enable row level security;
alter table provider_circuit_states enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on runtime_rate_limit_buckets, provider_circuit_states from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on runtime_rate_limit_buckets, provider_circuit_states from authenticated;
  end if;
end $$;
