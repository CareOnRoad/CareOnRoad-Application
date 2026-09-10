# Quickstart: Notification Inbox API

```powershell
npm.cmd test -- src/features/notifications
npm.cmd run test:db -- src/server/repositories/postgres/__tests__/notification-inbox.repository.integration.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Expected: owner-only stable pagination/count; mark-one and mark-all are replay-safe; delivery state is unchanged; audit contains no notification content; no outbox event is created.
