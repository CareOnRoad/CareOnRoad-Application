# Data Model: Media Signed Upload

## `media_upload_intents`

- `id uuid` primary key
- `actor_id uuid` references `app_users`
- `resource_type text` check `service_request | assignment`
- `request_id uuid` references `service_requests`
- `assignment_id uuid` nullable references `assignments`
- `purpose text` bounded
- `storage_bucket text`, `object_key text` unique
- `content_type text` check `image/jpeg | image/png | image/webp`
- `size_bytes bigint` check `1..8388608`
- `sha256 text` check 64 lowercase hex
- `status text` check `pending | finalized | expired`
- `media_metadata_id uuid` nullable
- `expires_at`, `finalized_at`, `created_at`, `updated_at`
- `cleanup_lease_owner`, `cleanup_lease_expires_at`

Invariants:
- request context has no assignment; assignment context has one matching request and assignment.
- finalized status requires metadata ID/time; other states cannot hold them.
- object key is unique and server-generated.
- cleanup claims only expired pending rows with absent/stale leases.

## Existing media rows

- Request finalization creates one `service_request_media` row with `object_reference = storage://{bucket}/{key}`.
- Assignment finalization creates one `assignment_media_metadata` row with `media_reference = storage://{bucket}/{key}`.
- The intent stores the resulting metadata ID for replay, without a cross-table polymorphic foreign key.

## State transitions

```text
pending --verified finalize--> finalized
pending --expiry cleanup-----> expired
```

No transition leaves a terminal state.
