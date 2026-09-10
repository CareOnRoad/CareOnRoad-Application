# Contract: Admin Operational Monitoring

All routes require an active admin JWT and accept `limit` (1–100) plus opaque `cursor`.

- `GET /api/v1/admin/operations/outbox-dead-letters`
- `GET /api/v1/admin/operations/payments-needs-review`
- `GET /api/v1/admin/operations/dispatch-stuck`
- `GET /api/v1/admin/operations/worker-runs`

Success shape: `{ "items": [...], "next_cursor"?: "opaque" }`.

DTOs contain only resource IDs, generic type/status/error code, numeric attempts/counts, and timestamps. They never contain raw payload, payment/provider data, rider data, problem/location, secret, or stack trace.
