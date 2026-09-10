# Data Model: Notification Provider Delivery

## Notification Delivery Receipt

- `id`: UUID primary key
- `notification_id`: required notification reference
- `credential_id`: required device delivery credential reference
- `credential_version`: positive version captured at send time
- `provider`: supported push provider
- `status`: `pending`, `sent`, `invalid`, `permanent_failed`, `retryable_failed`
- `attempt_count`: non-negative provider attempt count
- `provider_message_id`: optional bounded non-secret provider identifier
- `last_error_code`: optional sanitized code
- `last_attempted_at`, `completed_at`, `created_at`, `updated_at`: timestamps

## Relationships and constraints

- A notification has zero or more delivery receipts.
- A delivery credential has receipts across notifications and versions.
- Unique `(notification_id, credential_id, credential_version)` enforces local deduplication.
- Receipt ownership is derived through notification recipient and credential owner; both must match before delivery.
- Raw token, ciphertext, IV, authentication tag, authorization header, and raw provider response are forbidden in receipt rows.

## State transitions

```text
pending -> sent
pending -> invalid
pending -> permanent_failed
pending -> retryable_failed -> sent | invalid | permanent_failed | retryable_failed
```

Terminal states are `sent`, `invalid`, and `permanent_failed`. A retry starts only from `retryable_failed` or a newly created `pending` receipt.
