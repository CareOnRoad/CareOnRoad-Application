# Tasks: Dispatch Round Scheduler

- [X] T001 Add failing migration static tests in `src/server/db/__tests__/dispatch-round-lease-migration.test.ts`
- [X] T002 Add migration `supabase/migrations/202606250021_dispatch_round_leases.sql`
- [X] T003 Add lease fields/claim/release methods to dispatch repository contract and adapters
- [X] T004 Add worker tests for advance, escalation, duplicate claims, and failure isolation in `src/features/dispatch/__tests__/dispatch.worker.test.ts`
- [X] T005 Refactor `src/features/dispatch/dispatch.service.ts` to process a claimed expired round and reuse next-round ranking
- [X] T006 Implement `src/server/workers/dispatch.worker.ts` with bounded leases and per-item transactions
- [X] T007 Add protected route tests in `src/features/dispatch/__tests__/dispatch-worker.routes.test.ts`
- [X] T008 Implement `src/features/dispatch/dispatch-worker.route-handlers.ts` and `app/api/v1/internal/workers/dispatch/run/route.ts`
- [X] T009 Add PostgreSQL claim/concurrency coverage to `src/server/repositories/postgres/__tests__/dispatch.repository.integration.test.ts`
- [X] T010 Document secret-safe cron invocation in `specs/008-dispatch-round-scheduler/quickstart.md`
- [X] T011 Run focused tests/typecheck and full unit/lint/build validation
- [X] T012 Attempt DB integration and record the external tenant `ENOTFOUND` blocker without exposing credentials
