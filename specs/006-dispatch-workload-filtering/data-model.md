# Data Model: Dispatch Active-Workload Filtering

## Existing entities

### Assignment

- `mechanic_id`: owner of the assigned work.
- `status`: active for `accepted`, `en_route`, `on_site`, `diagnosis`, `quoted`,
  `awaiting_payment`, or `in_progress`; terminal for `completed` or `canceled`.
- Existing partial unique indexes enforce at most one active assignment per
  mechanic and per service request.

### Dispatch candidate

- Existing mechanic eligibility and ranking fields are unchanged.
- `activeWorkloadCount` is computed transiently and is not persisted or exposed.

## Repository read model

### MechanicActiveWorkload

| Field | Type | Rule |
|---|---|---|
| `mechanicId` | string | One of the requested mechanic IDs |
| `activeAssignmentCount` | non-negative integer | Count in canonical active states |

Missing rows mean zero. Empty mechanic input returns an empty result without SQL.

## State, concurrency, and migration impact

No state transition or migration is introduced. The batch read is an advisory
snapshot. Acceptance re-checks active work under locks, and database constraints
remain authoritative.
