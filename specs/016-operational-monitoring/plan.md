# Implementation Plan: Operational Monitoring APIs

**Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

## Summary

Add a PostgreSQL operational monitoring repository, append-only sanitized worker-run records, and four admin-only GET endpoints with opaque cursor pagination and strict DTO redaction.

## Technical Context

**Stack**: TypeScript, Next.js route handlers, Zod, existing postgres/UnitOfWork  
**Migration**: `202606250028_operational_monitoring.sql`  
**Tests**: repository contracts, route/service authorization/privacy, PostgreSQL integration, migration lifecycle, full gates  
**Constraints**: no new dependency, no mutation/replay commands, no raw payload/provider/private data

## Constitution Check

PASS: backend-only, admin RBAC, repository/migration/RLS, secret isolation, redaction and read-only behavior. No chatbot/ASR/payment transaction/frontend scope changes. Post-design check: PASS.

## Design

- `OperationalMonitoringRepository` provides four newest-first page queries and `appendWorkerRun`.
- Cursor is base64url JSON `{t,id}` validated server-side; only timestamp/id participate in SQL predicates.
- `worker_run_records` is append-only through a trigger and server-only RLS/grants.
- Existing worker entrypoints record sanitized success/failure summaries through one helper; business processing remains unchanged.
- Stuck query selects `dispatching|offered` requests older than a clamped threshold and excludes a still-valid active round.

## Structure

```text
src/features/operations/*
app/api/v1/admin/operations/{outbox-dead-letters,payments-needs-review,dispatch-stuck,worker-runs}/route.ts
src/server/repositories/contracts/operational-monitoring.repository.ts
src/server/repositories/{postgres,testing}/*operational-monitoring.repository.ts
src/server/workers/worker-run-recorder.ts
supabase/migrations/202606250028_operational_monitoring.sql
```

## Complexity Tracking

No exception.
