# Data Model: CareOnRoad Payment

## PaymentOrder

- `id`
- `quote_id`
- `request_id`
- `assignment_id`
- `rider_id`
- `provider`: `payos`
- `provider_order_code`
- `provider_payment_link_id`
- `status`: `created | pending | succeeded | failed | canceled | needs_review`
- `currency`: `VND`
- `amount`
- `checkout_url`
- `qr_code`
- `description`
- `failure_code`
- `review_reason`
- timestamps: created, updated, expires, succeeded, canceled

Rules:

- One active order per quote for `created | pending | failed`.
- Succeeded/canceled timestamps must match terminal status.
- Amount is a positive integer VND amount.

## PaymentEvent

- `id`
- `provider`
- `event_dedupe_key`
- optional `payment_order_id`
- provider order/link/reference metadata
- amount/currency/status
- `signature_valid`
- `received_at`

Rules:

- Unique provider event dedupe key.
- Stores sanitized webhook metadata only, never raw provider payload or secrets.

## Workflow

```text
quote approved
  -> request/assignment awaiting_payment
  -> payment order pending
  -> verified webhook succeeded
  -> mechanic/admin assignment status in_progress
```

Mismatches go to `needs_review`; failed provider events go to `failed`.
