# Research: Live Location Tracking Backend

## Data minimization

- **Decision**: Store one latest point per assignment, overwritten transactionally; do not create an event/history table.
- **Rationale**: Polling only needs current position. This materially reduces breach and retention exposure.
- **Alternatives considered**: Append-only GPS history enables route playback/analytics but violates current scope and increases privacy risk.

## Explicit retention gate

- **Decision**: Tracking is disabled by default and enabled ingest requires an explicit 1–1440 minute retention value. Every point receives `expires_at`; read filters it immediately and cleanup deletes it later.
- **Rationale**: Product/legal policy has not provided a duration, so no destructive/privacy default may be inferred.
- **Alternatives considered**: A conventional 24-hour or 30-day default is unsafe; session-only memory would not support multi-instance backend polling.

## Concurrency and replay

- **Decision**: Lock the assignment row, re-check travel status/ownership, then lock/read the latest row before validating monotonic observed time and minimum receipt interval.
- **Rationale**: Application-only rate limiting cannot prevent cross-instance races. A transaction makes the newest accepted point deterministic.
- **Alternatives considered**: In-memory limiter is bypassable across instances; last-write-wins can allow delayed/replayed points to replace newer data.

## Lifecycle deletion

- **Decision**: An assignment-status trigger deletes its live-location row whenever status is not `accepted` or `en_route`.
- **Rationale**: Covers all current/future transition code paths, recovery, and direct server operations without trusting one service hook.

## Authorization and RLS

- **Decision**: Backend service authorizes assigned mechanic writes and owner/mechanic/admin reads. Enable RLS with no client-facing policies.
- **Rationale**: Existing backend uses service-controlled repositories; raw coordinate access must not be possible through direct client table APIs.

## Operational privacy

- **Decision**: Do not audit/outbox individual points; do not log raw coordinates; worker returns only selected/deleted counts.
- **Rationale**: Copying GPS into durable operational records would defeat short retention.
