# Quickstart: Validate Dispatch Active-Workload Filtering

## Focused static and unit validation

```powershell
npm.cmd test -- src/features/dispatch/__tests__/dispatch-ranking.test.ts src/features/dispatch/__tests__/dispatch.service.test.ts
npm.cmd run typecheck
```

Verify busy mechanics are absent, terminal-only mechanics remain eligible,
all-busy input is controlled, ordering is stable, and the batch method is called
exactly once with the complete eligible mechanic cohort.

## PostgreSQL validation

With `TEST_DATABASE_URL` loaded securely through the existing local environment:

```powershell
npm.cmd run test:db -- src/server/repositories/postgres/__tests__/dispatch.repository.integration.test.ts src/features/dispatch/__tests__/dispatch-performance.integration.test.ts src/server/repositories/postgres/__tests__/assignment-accept.integration.test.ts
```

Never print the connection value. Confirm default `DispatchService` uses real
persisted assignments without injected callbacks.

## Regression validation

```powershell
npm.cmd test -- src/features/assignments/__tests__/assignment-accept.concurrency.test.ts
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Expected: acceptance races still create at most one active assignment, with no
API response or frontend change.
