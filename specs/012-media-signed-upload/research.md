# Research: Media Signed Upload

## Decision 1: Supabase signed upload REST behind an internal adapter

Use `POST /storage/v1/object/upload/sign/{bucket}/{path}` with backend service-role headers and return only the signed URL/token-bearing URL. Upload is performed directly by the client with `PUT`.

Rationale: Supabase officially supports signed upload URLs without further authentication and documents a two-hour provider validity. The upstream Storage client source confirms the REST path and PUT behavior. Wrapping raw fetch avoids a new dependency.

Sources:
- https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
- https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl
- https://github.com/supabase/storage-js/blob/main/src/packages/StorageFileApi.ts

## Decision 2: Verify digest by bounded streaming download

Use authenticated private-object download and incrementally compute SHA-256 while enforcing a hard 8 MiB ceiling. Compare observed content type, size, and digest to the intent.

Rationale: `storage.objects` exposes metadata but not a guaranteed trustworthy content digest. The Storage schema is read-only and operations must go through the API. Streaming gives actual-byte integrity without persisting raw media.

Source: https://supabase.com/docs/guides/storage/schema/design

## Decision 3: Private bucket with defense-in-depth limits

Configure a private bucket named by `MEDIA_STORAGE_BUCKET`, with matching JPEG/PNG/WebP and 8 MiB restrictions. The application independently validates the same bounds.

Rationale: Supabase recommends private buckets for sensitive material and supports per-bucket MIME/size restrictions.

Sources:
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/guides/storage/uploads/file-limits

## Decision 4: Database intent lifetime is stricter than provider lifetime

The application expires intent finalization after ten minutes even though the provider URL can remain technically usable longer. Cleanup removes late orphan objects by exact path.

## Alternatives rejected

- Client-chosen object paths: enables cross-resource overwrite and traversal risks.
- Trusting client checksum or Storage metadata alone: does not prove uploaded bytes.
- Proxying initial uploads through Next.js: increases API memory/bandwidth and violates direct-upload goal.
- Editing `storage.objects` directly: unsupported and risks inaccessible billed objects.
