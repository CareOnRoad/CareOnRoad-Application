# Tasks: Operational Monitoring APIs

## Phase 1: Persistence

- [x] T001 Add migration static test in `src/server/db/__tests__/operational-monitoring-migration.test.ts`
- [x] T002 Add worker-run table/index/RLS/append-only migration in `supabase/migrations/202606250028_operational_monitoring.sql`
- [x] T003 Add operational monitoring repository contract in `src/server/repositories/contracts/operational-monitoring.repository.ts`
- [x] T004 Add in-memory adapter/contract tests in `src/server/repositories/testing/in-memory-operational-monitoring.repository.ts` and `src/server/repositories/testing/__tests__/operational-monitoring.repository.contract.test.ts`
- [x] T005 Add PostgreSQL adapter in `src/server/repositories/postgres/operational-monitoring.repository.ts`
- [x] T006 Wire repository through UnitOfWork adapters in `src/server/repositories/contracts/unit-of-work.ts`, `src/server/repositories/postgres/postgres-unit-of-work.ts`, and `src/server/repositories/testing/in-memory-unit-of-work.ts`

## Phase 2: Intervention Queues (US1)

- [x] T007 [US1] Add schemas/cursor and privacy tests in `src/features/operations/__tests__/operational-monitoring.service.test.ts`
- [x] T008 [US1] Implement admin-authorized redacted query service in `src/features/operations/operational-monitoring.service.ts`
- [x] T009 [US1] Add route tests in `src/features/operations/__tests__/operational-monitoring.routes.test.ts`
- [x] T010 [US1] Add route handlers and four admin operation routes in `src/features/operations/operational-monitoring.route-handlers.ts` and `app/api/v1/admin/operations/**/route.ts`

## Phase 3: Worker Runs (US2)

- [x] T011 [US2] Add worker run recorder tests in `src/server/workers/__tests__/worker-run-recorder.test.ts`
- [x] T012 [US2] Implement sanitized recorder in `src/server/workers/worker-run-recorder.ts`
- [x] T013 [US2] Instrument current protected worker routes in their existing `src/features/*/*.route-handlers.ts` files

## Phase 4: Database and Validation

- [x] T014 Add PostgreSQL pagination/privacy integration test in `src/server/repositories/postgres/__tests__/operational-monitoring.repository.integration.test.ts`
- [x] T015 Update migration inventories through migration 028
- [x] T016 Update AGENTS status/routes and `OPERATIONS_STUCK_DISPATCH_MINUTES` environment docs
- [x] T017 Run focused/full tests, DB integration, typecheck, lint, build and write `specs/016-operational-monitoring/validation.md`

## Dependencies

T001→T002→T003–T006; T007→T008→T009→T010; T011→T012→T013; T014–T017 close the feature.
