# Contract: Media Upload API

## POST `/api/v1/media/upload-intents`

Headers: `Authorization: Bearer ...`, `X-Idempotency-Key`.

Body:
```json
{
  "resource_type": "service_request",
  "resource_id": "uuid",
  "purpose": "problem_photo",
  "content_type": "image/jpeg",
  "size_bytes": 12345,
  "sha256": "64 lowercase hex"
}
```

Response `201` or replay `200`:
```json
{
  "intent_id": "uuid",
  "resource_type": "service_request",
  "resource_id": "uuid",
  "object_key": "requests/.../uuid.jpg",
  "upload_url": "https://...signed...",
  "upload_method": "PUT",
  "required_headers": { "content-type": "image/jpeg" },
  "expires_at": "ISO-8601"
}
```

The response never includes bucket credentials, service-role key, or checksum.

## POST `/api/v1/media/upload-intents/{intentId}/finalize`

Headers: `Authorization: Bearer ...`, `X-Idempotency-Key`.

Empty JSON body. Response `201` or replay `200` contains safe finalized media metadata and no signed URL/checksum.

## POST `/api/v1/internal/workers/media-uploads/cleanup`

Headers: `X-Worker-Secret`, optional `X-Worker-Id`.

Response `202`:
```json
{ "claimed": 2, "expired": 2, "failed": 0 }
```

## Controlled errors

- `400 INVALID_INPUT`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 NOT_FOUND` (non-disclosing ownership failure)
- `409 CONFLICT` (quota, state, idempotency mismatch)
- `502 PROVIDER_ERROR` (sanitized, retryable)
