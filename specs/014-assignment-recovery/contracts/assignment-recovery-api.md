# Contract: Assignment Recovery API

## POST `/api/v1/assignments/{assignmentId}/recover`

Headers:

- `Authorization: Bearer <Supabase JWT>`
- `X-Idempotency-Key: <opaque non-empty key>`

Body:

```json
{ "reason_code": "cannot_continue" }
```

Allowed reason codes are `cannot_continue`, `no_show`, and `lost_contact`. Mechanics may submit only `cannot_continue`; admins may submit all three.

Success `200`:

```json
{
  "assignment_id": "uuid",
  "request_id": "uuid",
  "status": "recovery_canceled",
  "reason_code": "cannot_continue",
  "redispatch_status": "queued",
  "recovered_at": "ISO-8601"
}
```

Replay returns the same status/body. Controlled errors use the shared `{ error: { code, message, details? } }` envelope.

## Internal outbox consumer

Topic: `assignment.recovery.requested`. A successful consumer outcome means the request is already safely advanced or a new dispatch round has been created; retryable failures remain governed by the outbox worker.
