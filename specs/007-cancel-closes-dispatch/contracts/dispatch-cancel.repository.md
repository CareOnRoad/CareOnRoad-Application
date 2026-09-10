# Contract: Cancel Open Dispatch For Request

## `findCandidateById(id)`

Returns an immutable snapshot without a row lock. Acceptance uses it only to
discover the request, then re-reads the candidate under lock after locking the
request. No decision may rely only on the snapshot.

## `cancelOpenDispatchForRequest(requestId, now)`

- Runs within the caller's UnitOfWork transaction.
- Changes pending/offered candidates belonging to active rounds to `cancelled`.
- Changes active rounds to `canceled` with `completedAt = now`.
- Returns `{ canceledRounds, canceledCandidates }`.
- Repeated execution returns zero counts and performs no additional mutation.
- Preserves all historical and terminal rows.
