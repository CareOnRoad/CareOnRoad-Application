# Contract: Review API

## POST `/api/v1/assignments/{assignmentId}/review`

Headers: `Authorization: Bearer ...`, `X-Idempotency-Key`.

Body:
```json
{ "rating": 5, "comment": "Nhanh và rõ ràng" }
```

Response `201` (or canonical replay):
```json
{
  "id": "uuid",
  "assignment_id": "uuid",
  "request_id": "uuid",
  "mechanic_id": "uuid",
  "rating": 5,
  "comment": "Nhanh và rõ ràng",
  "created_at": "ISO-8601",
  "mechanic_rating": { "average": 4.5, "count": 2 }
}
```

No rider ID, idempotency key, or internal event fields are returned.

## POST `/api/v1/internal/workers/reviews/rebuild-ratings`

Headers: `X-Worker-Secret`, optional `X-Worker-Id`.

Response `202`: `{ "mechanics_rebuilt": 12 }`.

## Errors

- `400 INVALID_INPUT`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `409 CONFLICT`
