# Quickstart: Dispatch Round Scheduler

```powershell
npm.cmd test -- src/features/dispatch/__tests__/dispatch.worker.test.ts src/features/dispatch/__tests__/dispatch-worker.routes.test.ts src/server/db/__tests__/dispatch-round-lease-migration.test.ts
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

For a confirmed test/dev database, run the focused dispatch DB integration suite.
Configure cron to POST the internal route with `X-Worker-Secret` from deployment
secret storage. Never place the value in source, frontend code, or cron docs.

Recommended cadence is every 30–60 seconds, with only one short HTTP invocation
per tick; concurrency is safe but unnecessary load should be avoided. A local
PowerShell smoke call can source the existing environment value without printing it:

```powershell
$dispatchHeaders = @{
  "X-Worker-Secret" = $env:INTERNAL_WORKER_SECRET
  "X-Worker-Id" = "dispatch-cron"
}
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/internal/workers/dispatch/run" -Headers $dispatchHeaders
```

Production cron must use its platform secret reference and HTTPS endpoint. Treat
401 as configuration failure; retry transient 5xx responses on the next tick.
