# Quickstart: Assignment Recovery

1. Apply migration `202606250027_assignment_recovery.sql` to a test/development database.
2. Create an accepted assignment fixture and obtain its assigned mechanic JWT.
3. Call the recovery endpoint with `X-Idempotency-Key` and `cannot_continue`.
4. Assert the assignment is `recovery_canceled`, request is `submitted`, history/audit/outbox exist, and no active assignment remains.
5. Run the protected outbox worker and assert one new active dispatch round or a controlled manual-escalation outcome.
6. Replay the command and worker event; assert no duplicate state transition or round.

Validation:

```powershell
npm.cmd test -- src/features/assignments/__tests__/assignment-recovery.service.test.ts src/features/assignments/__tests__/assignment-recovery.routes.test.ts src/features/outbox/__tests__/outbox.worker.test.ts
npm.cmd run test:db -- src/server/repositories/postgres/__tests__/assignment-recovery.repository.integration.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```
