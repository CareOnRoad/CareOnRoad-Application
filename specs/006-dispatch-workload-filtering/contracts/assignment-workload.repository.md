# Contract: Assignment Active-Workload Batch Read

## Operation

`listActiveWorkloadsByMechanicIds(mechanicIds)`

## Input and output

- Input is a readonly list of mechanic IDs; duplicates may be normalized.
- Empty input returns an empty collection immediately.
- Output contains at most one `{ mechanicId, activeAssignmentCount }` item per
  requested mechanic and no assignment/request/job details.
- Zero-count mechanics may be omitted; callers normalize missing rows to zero.

## Semantics

- Count only canonical active assignment statuses.
- Exclude `completed` and `canceled` assignments.
- PostgreSQL uses one grouped query; in-memory uses one pass.
- The method is read-only and acquires no row locks.
- Dispatch calls it once after eligibility and prior-round deduplication, then
  excludes positive counts before ranking.
- Atomic offer acceptance remains authoritative if workload changes later.
