# Data Model: Cancel Request Closes Dispatch

No new entity or migration is introduced.

## Atomic state changes

| Entity | Eligible before | Successful cancel after |
|---|---|---|
| Service request | submitted, dispatching, offered | canceled |
| Dispatch round | active | canceled |
| Dispatch candidate | pending, offered | cancelled |
| Other candidate states | accepted, rejected, expired, cancelled | unchanged |

## Invariants

- A canceled request has no pending/offered candidate and no active round.
- A canceled request has no active assignment.
- Exactly one request history transition and one audit/outbox occurrence are
  written per successful logical command.
- No row is hard-deleted.
