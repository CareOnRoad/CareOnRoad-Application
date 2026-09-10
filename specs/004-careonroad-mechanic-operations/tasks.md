# Tasks: CareOnRoad Mechanic Operations

**Input**: Design documents from
`/specs/004-careonroad-mechanic-operations/`

**Prerequisites**: plan.md, spec.md

**Tests**: Required. Each user story writes focused route/service/repository
tests before or with implementation and retains the full regression suite.

**Organization**: Tasks are grouped by independently testable user story.

## User Story Index

| Story | Task IDs | Priority |
|---|---|---|
| US1 - Mechanic Dashboard MVP | T001-T011 | P1 |
| US2 - Mechanic Job List and Performance | T012-T024 | P1 |
| US3 - ETA and Delay Updates | T025-T036 | P2 |
| US4 - Mechanic Field Media Metadata | T037-T047 | P2 |
| US5 - Completion Checklist | T048-T059 | P2 |
| Final verification | T060-T070 | Cross-cutting |

## Phase 1: User Story 1 - Mechanic Dashboard MVP (Priority: P1)

**Goal**: Mechanic can read a scoped operational dashboard with availability,
location freshness, open offers, active assignment, today counts, seven-day
metrics, rating, and next action codes.

**Independent Test**: Seed empty, stale-location, open-offer, and active-job
fixtures for one mechanic and verify the dashboard response, auth, role checks,
and absence of cross-mechanic data.

### Tests

- [x] T001 [P] [US1] Write dashboard route tests for missing auth, invalid token, inactive actor, non-mechanic actor, active mechanic success, and stable errors in src/features/mechanic-operations/__tests__/mechanic-dashboard.route-handlers.test.ts
- [x] T002 [P] [US1] Write dashboard service tests for empty dashboard, active job, open offers, stale location, rating summary, today counts, seven-day metrics, and next action codes in src/features/mechanic-operations/__tests__/mechanic-dashboard.service.test.ts
- [x] T003 [P] [US1] Write repository contract tests for bounded mechanic dashboard aggregates and no cross-mechanic leakage in src/server/repositories/testing/__tests__/mechanic-operations-dashboard.repository.contract.test.ts

### Implementation

- [x] T004 [US1] Create mechanic operations schemas for actor-safe dashboard DTOs and next action codes in src/features/mechanic-operations/mechanic-operations.schemas.ts
- [x] T005 [US1] Implement active-mechanic authorization helper using backend actor/profile identity in src/features/mechanic-operations/mechanic-operations.authorization.ts
- [x] T006 [US1] Add mechanic dashboard read-model methods to repository contracts only where existing contracts are insufficient in src/server/repositories/contracts/mechanic-operations.repository.ts
- [x] T007 [P] [US1] Implement PostgreSQL mechanic dashboard aggregate queries without dashboard persistence in src/server/repositories/postgres/mechanic-operations.repository.ts
- [x] T008 [P] [US1] Implement in-memory mechanic dashboard aggregate queries in src/server/repositories/testing/in-memory-mechanic-operations.repository.ts
- [x] T009 [US1] Register mechanic operations repository dependencies in src/server/repositories/contracts/unit-of-work.ts, src/server/repositories/postgres/postgres-unit-of-work.ts, and src/server/repositories/testing/in-memory-unit-of-work.ts
- [x] T010 [US1] Implement `MechanicDashboardService` read-only DTO composition in src/features/mechanic-operations/mechanic-dashboard.service.ts
- [x] T011 [US1] Add thin dashboard route adapter in app/api/v1/mechanics/me/dashboard/route.ts and handler factory in src/features/mechanic-operations/mechanic-operations.route-handlers.ts

---

## Phase 2: User Story 2 - Mechanic Job List and Performance (Priority: P1)

**Goal**: Mechanic can list owned jobs with filters/pagination and read derived
performance metrics without seeing other mechanics' data.

**Independent Test**: Seed assignments, offers, quotes, and ratings for two
mechanics; verify filters, cursor pagination, metrics, and ownership isolation.

### Tests

- [x] T012 [P] [US2] Write job-list route tests for `status`, `active_only`, `date_from`, `date_to`, `limit`, `cursor`, authorization, and stable validation errors in src/features/mechanic-operations/__tests__/mechanic-jobs.route-handlers.test.ts
- [x] T013 [P] [US2] Write performance route tests for authorization, date-range validation, empty metrics, and stable response shape in src/features/mechanic-operations/__tests__/mechanic-performance.route-handlers.test.ts
- [x] T014 [P] [US2] Write job-list service tests for active-only filtering, status filtering, date filtering, pagination, safe request context, and no cross-mechanic leakage in src/features/mechanic-operations/__tests__/mechanic-job-list.service.test.ts
- [x] T015 [P] [US2] Write performance service tests for completed/canceled jobs, acceptance rate, decline rate, average accept time, workflow durations, quote approval rate, rating average/count, and no payment metrics in src/features/mechanic-operations/__tests__/mechanic-performance.service.test.ts
- [x] T016 [US2] Write repository contract tests for mechanic-owned job cursors and performance aggregate reconciliation in src/server/repositories/testing/__tests__/mechanic-operations-jobs.repository.contract.test.ts

### Implementation

- [x] T017 [US2] Add job-list and performance query schemas and DTO mappers in src/features/mechanic-operations/mechanic-operations.schemas.ts
- [x] T018 [US2] Extend mechanic operations repository contract with bounded job list and performance methods in src/server/repositories/contracts/mechanic-operations.repository.ts
- [x] T019 [P] [US2] Implement PostgreSQL mechanic job list and performance aggregate queries in src/server/repositories/postgres/mechanic-operations.repository.ts
- [x] T020 [P] [US2] Implement in-memory mechanic job list and performance aggregate queries in src/server/repositories/testing/in-memory-mechanic-operations.repository.ts
- [x] T021 [US2] Implement `MechanicJobListService` with safe service-request context mapping in src/features/mechanic-operations/mechanic-job-list.service.ts
- [x] T022 [US2] Implement `MechanicPerformanceService` with derived metrics and no earnings/payout/payment fields in src/features/mechanic-operations/mechanic-performance.service.ts
- [x] T023 [P] [US2] Add thin jobs route adapter in app/api/v1/mechanics/me/jobs/route.ts
- [x] T024 [P] [US2] Add thin performance route adapter in app/api/v1/mechanics/me/performance/route.ts

---

## Phase 3: User Story 3 - ETA and Delay Updates (Priority: P2)

**Goal**: Assigned mechanic can update ETA or delay reason for an active
assignment with sanitized audit/outbox metadata and no live tracking UI.

**Independent Test**: Submit valid and invalid ETA/delay updates for owned,
unowned, active, and terminal assignments; verify transaction rollback and
sanitized metadata.

### Tests

- [X] T025 [P] [US3] Write migration static tests for ETA metadata constraints, assignment/mechanic references, indexes, RLS/direct-write protections, and no live-tracking or payment schema in src/server/db/__tests__/mechanic-operations-eta-migration.test.ts
- [X] T026 [P] [US3] Write repository tests for ETA metadata insert, assignment ownership lookup, active-state lock, rollback, and immutable history behavior in src/server/repositories/postgres/__tests__/mechanic-operations-eta.integration.test.ts
- [X] T027 [P] [US3] Write ETA service tests for assigned-mechanic-only access, active-state requirement, ETA from one minute to 24 hours in the future, delay reason bounds, stale state, missing idempotency key, idempotent replay, idempotency conflict, audit, and outbox in src/features/mechanic-operations/__tests__/mechanic-assignment-eta.service.test.ts
- [X] T028 [P] [US3] Write ETA route tests for authorization, UUID validation, payload validation, ownership, missing `X-Idempotency-Key`, replay, conflict, and stable errors in src/features/mechanic-operations/__tests__/mechanic-assignment-eta.route-handlers.test.ts

### Implementation

- [X] T029 [US3] Add next timestamped migration for assignment ETA/progress metadata under supabase/migrations/
- [X] T030 [US3] Extend mechanic operations schemas with ETA timestamp bounds from one minute to 24 hours in the future and delay reason validation in src/features/mechanic-operations/mechanic-operations.schemas.ts
- [X] T031 [US3] Extend repository contracts with assignment ownership lock and ETA metadata write methods in src/server/repositories/contracts/mechanic-operations.repository.ts
- [X] T032 [P] [US3] Implement PostgreSQL ETA metadata writes and assignment locks in src/server/repositories/postgres/mechanic-operations.repository.ts
- [X] T033 [P] [US3] Implement in-memory ETA metadata writes and assignment locks in src/server/repositories/testing/in-memory-mechanic-operations.repository.ts
- [X] T034 [US3] Implement ETA/delay command flow with transaction, state re-check, idempotent replay/conflict handling, sanitized audit, and outbox in src/features/mechanic-operations/mechanic-assignment-metadata.service.ts
- [X] T035 [US3] Add thin ETA route adapter in app/api/v1/assignments/[assignmentId]/eta/route.ts
- [X] T036 [US3] Add focused regression tests proving existing assignment status transitions and mechanic offer acceptance remain unchanged in src/features/mechanic-operations/__tests__/mechanic-eta-regression.test.ts

---

## Phase 4: User Story 4 - Mechanic Field Media Metadata (Priority: P2)

**Goal**: Assigned mechanic can attach metadata references for field media
without storing raw media or leaking raw payloads into audit/outbox.

**Independent Test**: Submit valid metadata and invalid raw-media/prohibited
payloads for owned and unowned assignments; verify metadata-only persistence.

### Tests

- [X] T037 [P] [US4] Write migration static tests for assignment media metadata references, content-type and size constraints, no raw media columns, indexes, RLS/direct-write protections, and no payment schema in src/server/db/__tests__/mechanic-operations-media-migration.test.ts
- [X] T038 [P] [US4] Write repository tests for media metadata insert, assignment ownership lock, active-state policy, rollback, and no raw payload persistence in src/server/repositories/postgres/__tests__/mechanic-operations-media.integration.test.ts
- [X] T039 [P] [US4] Write media service tests for metadata validation, prohibited raw media/base64/provider payloads, ownership, assignment state checks, missing idempotency key, idempotent replay, idempotency conflict, audit, and outbox redaction in src/features/mechanic-operations/__tests__/mechanic-assignment-media.service.test.ts
- [X] T040 [P] [US4] Write media route tests for authorization, UUID validation, payload validation, ownership, missing `X-Idempotency-Key`, replay, conflict, and stable errors in src/features/mechanic-operations/__tests__/mechanic-assignment-media.route-handlers.test.ts

### Implementation

- [X] T041 [US4] Add next timestamped migration for mechanic assignment media metadata under supabase/migrations/
- [X] T042 [US4] Extend mechanic operations schemas with media reference, purpose, content type, size, and prohibited raw payload validation in src/features/mechanic-operations/mechanic-operations.schemas.ts
- [X] T043 [US4] Extend repository contracts with media metadata write methods in src/server/repositories/contracts/mechanic-operations.repository.ts
- [X] T044 [P] [US4] Implement PostgreSQL media metadata writes in src/server/repositories/postgres/mechanic-operations.repository.ts
- [X] T045 [P] [US4] Implement in-memory media metadata writes in src/server/repositories/testing/in-memory-mechanic-operations.repository.ts
- [X] T046 [US4] Implement media metadata command flow with transaction, state re-check, idempotent replay/conflict handling, sanitized audit, and outbox in src/features/mechanic-operations/mechanic-assignment-metadata.service.ts
- [X] T047 [US4] Add thin media route adapter in app/api/v1/assignments/[assignmentId]/media/route.ts

---

## Phase 5: User Story 5 - Completion Checklist (Priority: P2)

**Goal**: Assigned mechanic can submit a work summary and safety checklist for
eligible assignments without bypassing the assignment state machine.

**Independent Test**: Submit valid and invalid checklists for owned, unowned,
eligible, and terminal assignments; verify append-only/immutable persistence and
no completion state bypass.

### Tests

- [X] T048 [P] [US5] Write migration static tests for append-only checklist revision records, work summary bounds, structured safety checks, indexes, RLS/direct-write protections, and no force-status/payment schema in src/server/db/__tests__/mechanic-operations-checklist-migration.test.ts
- [X] T049 [P] [US5] Write repository tests for checklist revision insert, latest-effective revision lookup, ownership lock, eligible-state policy, idempotent replay without duplicate revision, conflict replay, and rollback in src/server/repositories/postgres/__tests__/mechanic-operations-checklist.integration.test.ts
- [X] T050 [P] [US5] Write checklist service tests for allowed states, required work summary, required safety checklist, ownership, stale state, missing idempotency key, idempotent replay, idempotency conflict, audit, outbox, and no state-machine bypass in src/features/mechanic-operations/__tests__/mechanic-completion-checklist.service.test.ts
- [X] T051 [P] [US5] Write checklist route tests for authorization, UUID validation, payload validation, ownership, missing `X-Idempotency-Key`, replay, conflict, and stable errors in src/features/mechanic-operations/__tests__/mechanic-completion-checklist.route-handlers.test.ts

### Implementation

- [X] T052 [US5] Add next timestamped migration for completion checklist/work summary metadata under supabase/migrations/
- [X] T053 [US5] Extend mechanic operations schemas with work summary and structured safety checklist validation in src/features/mechanic-operations/mechanic-operations.schemas.ts
- [X] T054 [US5] Extend repository contracts with completion checklist write and read-for-assignment methods in src/server/repositories/contracts/mechanic-operations.repository.ts
- [X] T055 [P] [US5] Implement PostgreSQL completion checklist writes in src/server/repositories/postgres/mechanic-operations.repository.ts
- [X] T056 [P] [US5] Implement in-memory completion checklist writes in src/server/repositories/testing/in-memory-mechanic-operations.repository.ts
- [X] T057 [US5] Implement completion checklist command flow with append-only revisions, transaction, state re-check, idempotent replay/conflict handling, sanitized audit, and outbox in src/features/mechanic-operations/mechanic-assignment-metadata.service.ts
- [X] T058 [US5] Add thin completion-checklist route adapter in app/api/v1/assignments/[assignmentId]/completion-checklist/route.ts
- [X] T059 [US5] Add regression tests proving checklist submission does not complete, cancel, reassign, or otherwise bypass assignment state transitions in src/features/mechanic-operations/__tests__/mechanic-checklist-state-regression.test.ts

---

## Phase 6: Final Verification and Scope Guards

**Purpose**: Verify the mechanic operations feature remains backend-only,
mechanic-owned, and compatible with existing workflows.

- [X] T060 [P] Add static route coverage tests for all mechanic operation endpoints in src/features/mechanic-operations/__tests__/mechanic-operations-routes.static.test.ts
- [X] T061 [P] Add static scope tests proving no frontend UI, payment, Maps/live tracking UI, inventory, odometer reminder, chatbot rewrite, or ASR rewrite artifacts are introduced in src/features/mechanic-operations/__tests__/mechanic-operations-scope.static.test.ts
- [X] T062 [P] Add privacy regression tests scanning mechanic operation responses, audit metadata, outbox metadata, logs, and fixtures for secrets, raw media, raw audio, provider payloads, and payment-sensitive fields in src/features/mechanic-operations/__tests__/mechanic-operations-privacy-regression.test.ts
- [X] T063 [P] Add bounded read-model performance smoke tests for dashboard, jobs, and performance with five warm-up calls and 20 measured calls requiring at least 19 of 20 within two seconds in src/features/mechanic-operations/__tests__/mechanic-operations-performance.test.ts
- [X] T064 Verify mechanic operation migration filenames are concrete, timestamped, ordered, and included in static migration coverage in supabase/migrations/
- [X] T065 Run `npx.cmd supabase migration list` against the linked hosted/dev project and confirm the target is not production
- [X] T066 Run `npx.cmd supabase db push --dry-run` against the linked hosted/dev project before applying migrations
- [X] T067 Run `npm.cmd test`
- [X] T068 Run `npm.cmd run typecheck`
- [X] T069 Run `npm.cmd run lint`
- [X] T070 Run `npm.cmd run build`

---

## Dependencies and Execution Order

### Story Dependencies

```text
US1 dashboard foundation
  |-- US2 job list and performance
  |     |-- US3 ETA and delay updates
  |     |-- US4 field media metadata
  |     `-- US5 completion checklist
```

- **US1** establishes shared authorization, schemas, route-handler factory, and
  repository registration.
- **US2** extends read models for jobs and performance and can ship with US1 as
  the read-only MVP.
- **US3**, **US4**, and **US5** all depend on assignment ownership/state checks
  and can proceed in parallel after shared metadata repository boundaries are
  settled.

### Parallel Opportunities

- T001-T003 can run in parallel.
- T012-T016 can run in parallel after US1 schemas and authorization are agreed.
- PostgreSQL and in-memory repository tasks marked `[P]` can run in parallel
  after contracts are defined.
- US3, US4, and US5 route/service tests can be written in parallel because they
  target separate endpoint contracts.

## Parallel Examples

### US1

```text
T001 dashboard route tests
T002 dashboard service tests
T003 dashboard repository contract tests

Then in parallel:
T007 PostgreSQL dashboard queries
T008 in-memory dashboard queries
```

### US3-US5

```text
T027 ETA service tests
T039 media service tests
T050 checklist service tests

After migration/contracts:
T032 PostgreSQL ETA writes
T044 PostgreSQL media writes
T055 PostgreSQL checklist writes
```

## Implementation Strategy

### Recommended MVP

1. Complete US1 dashboard.
2. Complete US2 job list and performance.
3. Run focused route/service/repository tests plus `npm.cmd test`.

This read-only slice gives mechanics operational visibility without new durable
metadata risk.

### Incremental Delivery

1. US1-US2: read-only mechanic operations.
2. US3: ETA/delay metadata.
3. US4: field media metadata references.
4. US5: completion checklist metadata.
5. Final verification and scope guards.

## Notes

- Every task names its target file or directory.
- `[P]` means different files and no dependency on another incomplete task in
  the same phase.
- Migrations must use the next available timestamp at implementation time; task
  T064 verifies concrete filenames, ordering, and static migration coverage
  during final verification.
- No task authorizes frontend UI, payment, payment providers, settlement,
  inventory, Maps/live tracking UI, odometer reminders, chatbot rewrites, or
  ASR rewrites.
