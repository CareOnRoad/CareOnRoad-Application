# Research: Notification Inbox API

## Decision 1: Keyset cursor pagination

- **Decision**: Use opaque base64url JSON containing `created_at` and UUID, ordered descending.
- **Rationale**: Stable pages avoid offset drift when notifications are inserted concurrently and match existing project cursor patterns.
- **Alternatives considered**: Offset pagination can duplicate/skip rows under inserts.

## Decision 2: Idempotency by state transition

- **Decision**: Mark-one uses `read_at = coalesce(read_at, server_time)` and mark-all updates only unread rows at/before a cutoff; no idempotency header is required.
- **Rationale**: The operation is naturally idempotent and preserves the original read timestamp.
- **Alternatives considered**: Idempotency records add storage and request-key burden without additional safety.

## Decision 3: Non-disclosing ownership errors

- **Decision**: Repository updates require both notification ID and caller user ID; zero matches return `NOTIFICATION_NOT_FOUND`.
- **Rationale**: The same result for absent and foreign records prevents enumeration.

## Decision 4: Sanitized response metadata

- **Decision**: Apply the existing recursive audit sanitizer again at response mapping and omit dedupe/delivery internals.
- **Rationale**: Defense in depth protects older rows if the prohibited-key policy evolves.
