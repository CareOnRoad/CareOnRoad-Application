# Quickstart: Validate Cancel Request Closes Dispatch

```powershell
npm.cmd test -- src/features/service-requests/__tests__/service-request.service.test.ts src/features/admin/__tests__/admin-service-request.service.test.ts src/features/assignments/__tests__/assignment-accept.concurrency.test.ts
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

When a valid test/dev `TEST_DATABASE_URL` is available:

```powershell
npm.cmd run test:db -- src/server/repositories/postgres/__tests__/assignment-accept.integration.test.ts src/server/repositories/postgres/__tests__/admin-service-request.integration.test.ts
```

Never print the database URL. Confirm canceled offers are not visible, replay
does not duplicate events, rollback restores all rows, and each race has one winner.
