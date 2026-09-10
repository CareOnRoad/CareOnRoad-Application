# Quickstart: Media Signed Upload

1. Configure a private Supabase Storage bucket with JPEG/PNG/WebP allowlist and an 8 MiB maximum.
2. Set backend-only `MEDIA_STORAGE_BUCKET`; reuse `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `INTERNAL_WORKER_SECRET`.
3. Apply migration `202606250025_media_upload_intents.sql` to linked test/dev Supabase.
4. Create an intent with a rider/mechanic JWT and idempotency key.
5. Upload the image bytes with `PUT` to the returned signed URL and required content type.
6. Finalize the intent with another idempotency key.
7. Run the cleanup endpoint periodically with the worker secret.

Never print the signed URL, checksum, service-role key, raw image, or `.env.local` values.
