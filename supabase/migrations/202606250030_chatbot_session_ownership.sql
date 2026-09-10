alter table chatbot_sessions
  add column owner_credential_hash text,
  add column owner_claimed_at timestamptz,
  add constraint chatbot_sessions_owner_credential_hash_check
    check (owner_credential_hash is null or owner_credential_hash ~ '^[a-f0-9]{64}$'),
  add constraint chatbot_sessions_claim_consistency_check
    check (owner_claimed_at is null or owner_user_id is not null);

create index chatbot_sessions_owner_user_idx
  on chatbot_sessions (owner_user_id, updated_at desc, id)
  where owner_user_id is not null;

comment on column chatbot_sessions.owner_credential_hash is
  'SHA-256 of opaque owner credential; raw credential must never be persisted';
