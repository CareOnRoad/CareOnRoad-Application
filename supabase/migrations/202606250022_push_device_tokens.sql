alter table user_devices
  add constraint user_devices_id_user_unique unique (id, user_id);

create table device_delivery_credentials (
  id uuid primary key,
  device_id uuid not null,
  user_id uuid not null,
  provider text not null check (provider in ('fcm', 'apns', 'webpush')),
  credential_fingerprint text not null check (length(credential_fingerprint) = 64),
  credential_ciphertext text,
  credential_iv text,
  credential_tag text,
  encryption_key_version integer not null default 1 check (encryption_key_version > 0),
  credential_version integer not null default 1 check (credential_version > 0),
  enabled boolean not null default true,
  last_registered_at timestamptz not null,
  disabled_at timestamptz,
  disabled_reason text check (
    disabled_reason is null
    or disabled_reason in (
      'rotated', 'user_revoked', 'provider_invalid', 'device_limit', 'admin_revoked'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_delivery_credentials_device_owner_fk
    foreign key (device_id, user_id)
    references user_devices (id, user_id)
    on delete cascade,
  constraint device_delivery_credentials_state_check check (
    (
      enabled = true
      and credential_ciphertext is not null
      and credential_iv is not null
      and credential_tag is not null
      and disabled_at is null
      and disabled_reason is null
    )
    or (
      enabled = false
      and credential_ciphertext is null
      and credential_iv is null
      and credential_tag is null
      and disabled_at is not null
      and disabled_reason is not null
    )
  )
);

create unique index device_delivery_credentials_one_active_device_idx
  on device_delivery_credentials (device_id)
  where enabled = true;

create unique index device_delivery_credentials_one_active_fingerprint_idx
  on device_delivery_credentials (credential_fingerprint)
  where enabled = true;

create index device_delivery_credentials_user_active_idx
  on device_delivery_credentials (user_id, updated_at desc, id desc)
  where enabled = true;

create index user_devices_active_cleanup_idx
  on user_devices (user_id, last_registered_at desc, id desc)
  where enabled = true;

alter table device_delivery_credentials enable row level security;
revoke all on table device_delivery_credentials from anon, authenticated;
