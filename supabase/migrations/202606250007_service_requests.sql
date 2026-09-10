do $$
begin
  create type fulfillment_mode as enum ('immediate_location', 'scheduled_visit');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type request_status as enum (
    'submitted',
    'dispatching',
    'offered',
    'assigned',
    'mechanic_en_route',
    'in_service',
    'awaiting_quote_approval',
    'awaiting_payment',
    'completed',
    'manual_escalation',
    'canceled'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type request_priority as enum ('normal', 'high', 'emergency');
exception
  when duplicate_object then null;
end;
$$;

create table daily_request_sequences (
  local_date date not null,
  service_prefix text not null check (service_prefix in ('EMR', 'MOB', 'HOME', 'MNT', 'OTH')),
  last_sequence integer not null check (last_sequence >= 1),
  updated_at timestamptz not null default now(),
  primary key (local_date, service_prefix)
);

create table service_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique
    check (request_code ~ '^COR-(EMR|MOB|HOME|MNT|OTH)-[0-9]{8}-[0-9]+$'),
  rider_id uuid not null references app_users(id) on delete cascade,
  motorcycle_id uuid not null references motorcycles(id) on delete restrict,
  service_type service_type not null,
  fulfillment_mode fulfillment_mode,
  problem_description text not null check (length(problem_description) between 3 and 3000),
  status request_status not null default 'submitted',
  priority request_priority not null default 'normal',
  service_location geography(Point, 4326),
  address_text text check (address_text is null or length(address_text) between 1 and 500),
  scheduled_start_at timestamptz,
  safety_answers jsonb,
  maintenance_notes text check (maintenance_notes is null or length(maintenance_notes) between 1 and 2000),
  manual_escalation_reason text check (manual_escalation_reason is null or length(manual_escalation_reason) between 1 and 500),
  canceled_reason text check (canceled_reason is null or length(canceled_reason) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (service_type = 'other' and fulfillment_mode is not null)
    or (service_type <> 'other' and fulfillment_mode is null)
  ),
  check (
    (service_type = 'emergency_rescue' and service_location is not null and scheduled_start_at is null)
    or service_type <> 'emergency_rescue'
  ),
  check (
    (
      service_type = 'mobile_repair'
      and (service_location is not null or address_text is not null)
      and scheduled_start_at is null
    )
    or service_type <> 'mobile_repair'
  ),
  check (
    (
      service_type = 'at_home_service'
      and address_text is not null
      and scheduled_start_at is not null
      and scheduled_start_at > created_at
    )
    or service_type <> 'at_home_service'
  ),
  check (
    (
      service_type = 'periodic_maintenance'
      and scheduled_start_at is not null
      and scheduled_start_at > created_at
    )
    or service_type <> 'periodic_maintenance'
  ),
  check (
    (
      service_type = 'other'
      and fulfillment_mode = 'immediate_location'
      and (service_location is not null or address_text is not null)
      and scheduled_start_at is null
    )
    or service_type <> 'other'
    or fulfillment_mode <> 'immediate_location'
  ),
  check (
    (
      service_type = 'other'
      and fulfillment_mode = 'scheduled_visit'
      and address_text is not null
      and scheduled_start_at is not null
      and scheduled_start_at > created_at
    )
    or service_type <> 'other'
    or fulfillment_mode <> 'scheduled_visit'
  )
);

create index service_requests_rider_created_idx
  on service_requests (rider_id, created_at desc);
create index service_requests_motorcycle_idx
  on service_requests (motorcycle_id, created_at desc);
create index service_requests_status_idx
  on service_requests (status, created_at desc);
create index service_requests_location_idx
  on service_requests using gist (service_location)
  where service_location is not null;

create table request_media_metadata (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  media_type text not null check (length(media_type) between 1 and 50),
  object_reference text not null check (length(object_reference) between 1 and 1000),
  content_type text not null check (length(content_type) between 1 and 200),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  checksum text check (checksum is null or length(checksum) between 1 and 200),
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index request_media_metadata_request_idx
  on request_media_metadata (request_id, created_at desc);

create table request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  from_status request_status,
  to_status request_status not null,
  actor_id uuid references app_users(id) on delete set null,
  reason text check (reason is null or length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

create index request_status_history_request_idx
  on request_status_history (request_id, created_at desc);

alter table daily_request_sequences enable row level security;
alter table service_requests enable row level security;
alter table request_media_metadata enable row level security;
alter table request_status_history enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on daily_request_sequences, service_requests, request_media_metadata, request_status_history from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on daily_request_sequences, service_requests, request_media_metadata, request_status_history from authenticated;
  end if;
end;
$$;
