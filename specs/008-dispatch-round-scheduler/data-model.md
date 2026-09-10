# Data Model: Dispatch Round Scheduler

## Dispatch round additions

| Field | Type | Meaning |
|---|---|---|
| `lease_owner` | nullable text | Worker currently owning processing |
| `lease_expires_at` | nullable timestamptz | Recovery deadline |

Lease fields are cleared when a round leaves `active`. An index over active
`(expires_at, lease_expires_at)` supports due claims.

## Processing transitions

`active expired round → expired`; pending/offered candidates → `expired`.
Then either:

- create next `active` round at the next configured radius; or
- request `offered/dispatching → manual_escalation` after four rounds/total wait.

Canceled, assigned, or already escalated requests create no next round.
