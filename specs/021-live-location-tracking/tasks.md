# Tasks: Live Location Tracking Backend

## Phase 1: Setup

- [x] T001 Add opt-in/no-default tracking configuration and validation tests in `.env.example` and `src/features/live-tracking/__tests__/live-tracking.config.test.ts`
- [x] T002 [P] Add strict input schemas and configuration parser in `src/features/live-tracking/live-tracking.schemas.ts`

## Phase 2: Foundational Persistence

- [x] T003 Write migration static tests for latest-only schema, constraints, trigger, RLS, and indexes in `src/server/db/__tests__/live-location-tracking-migration.test.ts`
- [x] T004 Add migration `supabase/migrations/202606250032_live_location_tracking.sql`
- [x] T005 [P] Add repository contract and in-memory contract tests in `src/server/repositories/contracts/live-tracking.repository.ts` and `src/server/repositories/testing/__tests__/live-tracking.repository.contract.test.ts`
- [x] T006 Implement in-memory and PostgreSQL repositories in `src/server/repositories/testing/in-memory-live-tracking.repository.ts` and `src/server/repositories/postgres/live-tracking.repository.ts`
- [x] T007 Wire the repository through unit-of-work contracts/adapters in `src/server/repositories/contracts/unit-of-work.ts`, `src/server/repositories/testing/in-memory-unit-of-work.ts`, and `src/server/repositories/postgres/postgres-unit-of-work.ts`
- [x] T008 Add isolated PostgreSQL integration coverage for overwrite, expiry, trigger deletion, RLS, and bounded cleanup in `src/server/repositories/postgres/__tests__/live-tracking.repository.integration.test.ts`

## Phase 3: User Story 1 - Assigned mechanic ingest

**Independent Test**: Only the assigned mechanic can accept a valid fresh point in travel states; replay, stale/future, inaccurate, too-fast, disabled, and concurrent writes fail without replacing newer data.

- [x] T009 [US1] Write ingest authorization, validation, replay, rate, state, feature-gate, and concurrency tests in `src/features/live-tracking/__tests__/live-tracking.service.test.ts`
- [x] T010 [US1] Implement transactional latest-location ingest in `src/features/live-tracking/live-tracking.service.ts`
- [x] T011 [US1] Write PUT route tests and add thin ingest endpoint in `src/features/live-tracking/__tests__/live-tracking.routes.test.ts`, `src/features/live-tracking/live-tracking.route-handlers.ts`, and `app/api/v1/assignments/[assignmentId]/live-location/route.ts`

## Phase 4: User Story 2 - Authorized latest polling

**Independent Test**: Owner rider, assigned mechanic, and admin can poll one non-expired point; unrelated actors, expired points, and absent rows never disclose coordinates.

- [x] T012 [US2] Add latest-read ownership, expiry, and no-history tests in `src/features/live-tracking/__tests__/live-tracking.service.test.ts`
- [x] T013 [US2] Implement authorized latest read and GET route handling in `src/features/live-tracking/live-tracking.service.ts`, `src/features/live-tracking/live-tracking.route-handlers.ts`, and `app/api/v1/assignments/[assignmentId]/live-location/route.ts`

## Phase 5: User Story 3 - Automatic stop and cleanup

**Independent Test**: Leaving travel states deletes the row through the database trigger; worker-secret cleanup removes expired rows in 1–100 batches and is idempotent/concurrency-safe.

- [x] T014 [US3] Write cleanup worker/route and sanitized-summary tests in `src/features/live-tracking/__tests__/live-tracking-cleanup.test.ts`
- [x] T015 [US3] Implement bounded cleanup worker and protected route in `src/features/live-tracking/live-tracking-cleanup.worker.ts`, `src/features/live-tracking/live-tracking-cleanup.route-handlers.ts`, and `app/api/v1/internal/workers/live-locations/cleanup/route.ts`

## Phase 6: Polish and Validation

- [x] T016 [P] Add static privacy/scope checks for raw coordinates, history, realtime, and state mutation in `src/features/live-tracking/__tests__/live-tracking.scope.static.test.ts`
- [x] T017 Update migration inventories, backend status, routes, services, and environment docs in `src/server/db/__tests__/all-migrations.static.test.ts`, `src/server/db/__tests__/migration-lifecycle.integration.test.ts`, and `AGENTS.md`
- [x] T018 Run focused/full unit, isolated PostgreSQL, typecheck, lint, build, and diff validation and record results in `specs/021-live-location-tracking/validation.md`

## Dependencies

T001–T002 → T003–T008 → T009–T011 → T012–T013 → T014–T015 → T016–T018.

## Parallel Opportunities

- T001/T002 and T003/T005 can be prepared in independent files.
- Service/route tests are separate from migration integration tests after repository contracts stabilize.
- T016 can be prepared independently once endpoint and worker paths are final.

## Implementation Strategy

Land privacy/config and persistence foundations first, then ingest, polling, cleanup, and final cross-cutting validation. Execute tests before each implementation group; never emit raw coordinates in test failure snapshots or operational records.
