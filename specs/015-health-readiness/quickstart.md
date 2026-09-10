# Quickstart: Health and Readiness

```powershell
npm.cmd test -- src/features/health
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Call `/api/v1/internal/health/live` and `/api/v1/internal/health/ready`. Stop PostgreSQL or inject a failing probe in tests and verify readiness returns 503 with only generic states.
