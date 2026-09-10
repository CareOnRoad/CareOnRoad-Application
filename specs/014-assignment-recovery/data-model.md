# Data Model: Assignment Recovery

## Assignment

- Add terminal status `recovery_canceled` to `assignment_status`.
- `canceled_at` is required for both `canceled` and `recovery_canceled`.
- `recovery_canceled` is excluded from active assignment partial indexes, releasing mechanic and request workload.
- Existing identity, status-history, and RLS rules remain unchanged.

## Service Request

- Eligible source states are `assigned` and `mechanic_en_route`.
- Successful recovery returns the request to `submitted` with a new status-history row.
- Existing prior dispatch rounds/candidates remain historical; open artifacts are closed.

## Recovery Handoff

- Represented by an outbox event with topic `assignment.recovery.requested`.
- Payload fields: `assignment_id`, `request_id`, `mechanic_id`, `status`, `reason_code`.
- Dedupe is enforced by the recovery idempotency record and outbox event identity.

## State Transitions

```text
assignment: accepted|en_route -> recovery_canceled
request:    assigned|mechanic_en_route -> submitted
outbox:     pending -> processing -> sent|retry|dead-letter
request:    submitted -> dispatching -> offered (during handoff)
```
