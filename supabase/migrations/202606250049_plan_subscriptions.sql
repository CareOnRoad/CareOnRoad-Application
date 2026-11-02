-- Self-service plan subscriptions (rider purchases a plan tier via payOS).
--
-- `app_users.plan_code` / `plan_expires_at` stay the effective plan projection.
-- This table is the durable history of every purchase (and admin grant) so the
-- rider can see what they paid for and when it expires.
--
-- Provider order codes are allocated from the shared `payment_order_code_seq`
-- sequence so payOS order codes stay unique across repair payments and plan
-- purchases.

create table plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete restrict,
  plan_code text not null check (plan_code in ('advance', 'vip')),
  source text not null check (source in ('self_purchase', 'admin_grant')),
  provider payment_provider not null default 'payos',
  provider_order_code bigint,
  provider_payment_link_id text,
  status text not null default 'created'
    check (status in ('created', 'pending', 'succeeded', 'failed', 'canceled', 'expired')),
  currency text not null default 'VND' check (currency = 'VND'),
  amount numeric(12,0) not null check (amount >= 0),
  period_days integer not null default 30 check (period_days = 30),
  non_refundable_acknowledged boolean not null default false,
  checkout_url text check (checkout_url is null or length(checkout_url) <= 2048),
  qr_code text check (qr_code is null or length(qr_code) <= 4096),
  failure_code text check (failure_code is null or failure_code ~ '^[A-Za-z0-9_.-]{1,80}$'),
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz,
  canceled_at timestamptz,
  unique (provider, provider_order_code),
  check (
    (status = 'succeeded' and succeeded_at is not null)
    or (status <> 'succeeded' and succeeded_at is null)
  ),
  check (
    (status = 'canceled' and canceled_at is not null)
    or (status <> 'canceled' and canceled_at is null)
  )
);

create index plan_subscriptions_user_created_idx
  on plan_subscriptions (user_id, created_at desc, id desc);

create index plan_subscriptions_provider_code_idx
  on plan_subscriptions (provider, provider_order_code);

create table plan_subscription_events (
  id uuid primary key default gen_random_uuid(),
  provider payment_provider not null,
  event_dedupe_key text not null check (length(event_dedupe_key) between 1 and 200),
  subscription_id uuid references plan_subscriptions(id) on delete set null,
  provider_order_code bigint,
  provider_payment_link_id text,
  provider_reference text check (provider_reference is null or length(provider_reference) <= 120),
  event_type text not null check (event_type ~ '^[A-Za-z0-9_.-]{1,80}$'),
  amount numeric(12,0) check (amount is null or amount >= 0),
  currency text check (currency is null or currency = 'VND'),
  status text check (status is null or status ~ '^[A-Za-z0-9_.-]{1,80}$'),
  signature_valid boolean not null default false,
  received_at timestamptz not null default now(),
  unique (provider, event_dedupe_key)
);

create index plan_subscription_events_received_idx
  on plan_subscription_events (received_at desc, id desc);

alter table plan_subscriptions enable row level security;
alter table plan_subscription_events enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on plan_subscriptions from anon;
    revoke all on plan_subscription_events from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on plan_subscriptions from authenticated;
    revoke all on plan_subscription_events from authenticated;
    grant select on plan_subscriptions to authenticated;
  end if;
end;
$$;
