create type notification_delivery_status as enum (
  'pending',
  'sent',
  'invalid',
  'permanent_failed',
  'retryable_failed'
);

create table notification_delivery_receipts (
  id uuid primary key,
  notification_id uuid not null references notifications(id) on delete cascade,
  credential_id uuid not null references device_delivery_credentials(id) on delete cascade,
  credential_version integer not null check (credential_version > 0),
  provider text not null check (provider in ('fcm', 'apns', 'webpush')),
  status notification_delivery_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text check (provider_message_id is null or length(provider_message_id) <= 300),
  last_error_code text check (last_error_code is null or length(last_error_code) <= 100),
  last_attempted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_delivery_receipts_unique_version
    unique (notification_id, credential_id, credential_version),
  constraint notification_delivery_receipts_completion_check check (
    (status in ('pending', 'retryable_failed') and completed_at is null)
    or (status in ('sent', 'invalid', 'permanent_failed') and completed_at is not null)
  )
);

create index notification_delivery_receipts_notification_status_idx
  on notification_delivery_receipts (notification_id, status, created_at, id);

alter table notification_delivery_receipts enable row level security;
revoke all on table notification_delivery_receipts from anon, authenticated;
