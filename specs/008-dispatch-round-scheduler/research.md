# Research: Dispatch Round Scheduler

- Reminder/outbox workers establish worker-secret, lease-owner, lease-expiry,
  batch-result, and failure isolation patterns.
- Current `DispatchService.expireRound` can expire and escalate, but cannot open
  another round without a rider identity. Scheduler needs an internal service path.
- Existing prior-candidate query already supports no-repeat mechanic behavior.
- Existing dispatch-round schema has no lease fields, so one additive migration is required.
- `FOR UPDATE SKIP LOCKED` is the established PostgreSQL concurrency strategy.
- Manual escalation must append its own sanitized audit/outbox occurrence when
  caused by the scheduler; request-status recheck prevents duplicates.
