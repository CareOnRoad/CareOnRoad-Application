# Validation: Rider Review and Mechanic Rating

## Result

Feature 8 is complete. Only the owning rider can create one immutable review
after both assignment and request completion. Mechanic aggregates are derived
from review rows and can be rebuilt through a protected worker.

## Evidence

- Focused schema/service/route/repository/worker/migration tests: 8 passed.
- PostgreSQL integration: 8 concurrent duplicates produced one review; three
  reviews produced average 4.33/count 3; immutable update failed; rebuild reset
  the zero-review mechanic to 0/0.
- Complete migration lifecycle 001-026: 2 passed.
- Full unit/static/route suite: 434 passed across 133 files.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed and emitted review/create and rebuild routes.
- Supabase dry-run listed only `202606250026_service_reviews.sql`.
- Migration `026` was applied and local/remote lists align through `026`.

## Security and consistency checks

- Assignment/request/mechanic and request/rider identities use composite FKs.
- One assignment review is protected by a unique constraint and immutable trigger.
- Assignment and request must both be completed.
- Exact replay does not add aggregate/audit/outbox contributions; changed payload conflicts.
- Response omits rider ID; audit/outbox omit rider comment and idempotency key.
- Aggregate uses rounded `AVG` and `COUNT` from review rows, never prior profile values.

## Seed impact

Mock seeding no longer writes synthetic mechanic rating averages/counts. Migration
and rebuild reset profiles with no review rows to 0/0 so dispatch consumes trusted
review-derived data only.
