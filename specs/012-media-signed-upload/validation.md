# Validation: Media Signed Upload

## Result

Feature 7 is complete. Rider-owned requests and mechanic-owned active assignments
can reserve backend-generated private Storage paths, finalize only byte-verified
objects, and clean expired orphan uploads through a protected worker.

## Evidence

- Focused schema/provider/service/route/repository/worker/migration tests: 12 passed.
- PostgreSQL integration with eight concurrent finalizers: 1 passed and persisted one media row.
- Full unit/static/route suite: 426 passed across 128 files.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed and emitted create, finalize, and cleanup routes.
- Supabase dry-run listed only migration `202606250025_media_upload_intents.sql`.
- Migration `025` was applied and local/remote migration lists align through `025`.

## Security checks

- Strict input rejects client bucket/path/object-key/raw fields.
- Only JPEG, PNG, and WebP up to 8 MiB are accepted.
- Finalize compares actual streamed content type, byte count, and SHA-256.
- Concurrent/replayed finalize creates one metadata row, audit, and outbox event.
- Audit/outbox omit signed URLs, storage references, provider credentials, and checksums.
- Cleanup leases only expired pending intents and deletes exact server-owned keys.

## Deployment note

Provision `MEDIA_STORAGE_BUCKET` as a private Supabase Storage bucket with matching
MIME and 8 MiB restrictions. Supabase documents Storage schema as API-managed, so
the application migration intentionally does not mutate `storage.objects` or
`storage.buckets`.
