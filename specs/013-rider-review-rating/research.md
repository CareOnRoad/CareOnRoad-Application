# Research: Rider Review and Mechanic Rating

## Decision 1: Immutable lifecycle

Reviews cannot be updated or deleted. Same normalized payload replays the row;
different content conflicts. This gives a stable audit source and avoids an
unrequested moderation/correction workflow.

## Decision 2: Recompute, do not increment

After an insert, update `mechanic_profiles` using `round(avg(rating), 2)` and
`count(*)` from `service_reviews` inside the same transaction. This makes retries
and rebuilds use the same truth and never trust a prior aggregate.

## Decision 3: Insert-if-absent plus payload comparison

Use `INSERT ... ON CONFLICT (assignment_id) DO NOTHING`, then load the canonical
row. Equal payload is a replay; different payload conflicts. The unique constraint
handles different idempotency keys racing safely.

## Decision 4: Protected full rebuild

A worker-secret route calls one repository operation that updates all mechanic
profiles, including zero-review profiles. This is an operational repair command,
not an admin rating editor.

## Alternatives rejected

- Incremental `(old_avg * old_count + rating)/(old_count+1)`: vulnerable to drift and retry mistakes.
- Editable window: expands authorization, aggregate versioning, and moderation scope.
- Trigger-only aggregate logic: harder to unit-test behind current repository boundaries; the unique/immutable invariants remain database-enforced while service controls audited mutation.
