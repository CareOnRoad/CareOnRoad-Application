create type payment_provider as enum ('payos');

create type payment_order_status as enum (
  'created',
  'pending',
  'succeeded',
  'failed',
  'canceled',
  'needs_review'
);

create sequence payment_order_code_seq
  as bigint
  start with 100000
  increment by 1
  minvalue 100000
  maxvalue 999999999999
  cache 1;

create table payment_orders (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete restrict,
  request_id uuid not null,
  assignment_id uuid not null,
  rider_id uuid not null references app_users(id) on delete restrict,
  provider payment_provider not null default 'payos',
  provider_order_code bigint not null,
  provider_payment_link_id text,
  status payment_order_status not null default 'created',
  currency text not null default 'VND' check (currency = 'VND'),
  amount numeric(12,0) not null check (amount > 0),
  checkout_url text check (checkout_url is null or length(checkout_url) <= 2048),
  qr_code text check (qr_code is null or length(qr_code) <= 4096),
  description text not null check (description ~ '^[A-Z0-9]{3,12}$'),
  failure_code text check (failure_code is null or failure_code ~ '^[A-Za-z0-9_.-]{1,80}$'),
  review_reason text check (review_reason is null or review_reason ~ '^[A-Za-z0-9_.-]{1,80}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  succeeded_at timestamptz,
  canceled_at timestamptz,
  foreign key (assignment_id, request_id)
    references assignments (id, request_id)
    on delete restrict,
  unique (provider, provider_order_code),
  unique (provider, provider_payment_link_id),
  check (
    (status = 'succeeded' and succeeded_at is not null)
    or (status <> 'succeeded' and succeeded_at is null)
  ),
  check (
    (status = 'canceled' and canceled_at is not null)
    or (status <> 'canceled' and canceled_at is null)
  )
);

create unique index payment_orders_active_quote_idx
  on payment_orders (quote_id)
  where status in ('created', 'pending', 'failed');

create index payment_orders_request_created_idx
  on payment_orders (request_id, created_at desc, id desc);

create index payment_orders_assignment_status_idx
  on payment_orders (assignment_id, status, updated_at desc);

create table payment_events (
  id uuid primary key default gen_random_uuid(),
  provider payment_provider not null,
  event_dedupe_key text not null check (length(event_dedupe_key) between 1 and 200),
  payment_order_id uuid references payment_orders(id) on delete set null,
  provider_order_code bigint,
  provider_payment_link_id text,
  provider_reference text check (provider_reference is null or length(provider_reference) <= 120),
  event_type text not null check (event_type ~ '^[A-Za-z0-9_.-]{1,80}$'),
  amount numeric(12,0) check (amount is null or amount > 0),
  currency text check (currency is null or currency = 'VND'),
  status text check (status is null or status ~ '^[A-Za-z0-9_.-]{1,80}$'),
  signature_valid boolean not null default false,
  received_at timestamptz not null default now(),
  unique (provider, event_dedupe_key)
);

create index payment_events_order_received_idx
  on payment_events (payment_order_id, received_at desc, id desc);

alter table payment_orders enable row level security;
alter table payment_events enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on payment_orders from anon;
    revoke all on payment_events from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on payment_orders from authenticated;
    revoke all on payment_events from authenticated;
    grant select on payment_orders to authenticated;
  end if;
end;
$$;

create policy payment_orders_rider_select
  on payment_orders
  for select
  using (rider_id = auth.uid());

create policy payment_orders_mechanic_select
  on payment_orders
  for select
  using (
    exists (
      select 1
      from assignments assignment
      where assignment.id = payment_orders.assignment_id
        and assignment.mechanic_id = auth.uid()
    )
  );
