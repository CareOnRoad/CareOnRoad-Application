# Tasks: Assignment Recovery and Re-dispatch

**Input**: Design documents from `specs/014-assignment-recovery/`  
**Tests**: Required TDD coverage for migration, authorization, idempotency, concurrency, outbox, and dispatch handoff.

## Phase 1: Setup

- [X] T001 Add Feature 9 migration static test in `src/server/db/__tests__/assignment-recovery-migration.test.ts`
- [X] T002 Add `recovery_canceled` enum migration and constraints in `supabase/migrations/202606250027_assignment_recovery.sql`

## Phase 2: Foundational Contracts

- [X] T003 [P] Extend assignment contract/status mapping in `src/server/repositories/contracts/assignment.repository.ts`
- [X] T004 [P] Add recovery input schema in `src/features/assignments/assignment-recovery.schemas.ts`
- [X] T005 Extend PostgreSQL and in-memory assignment adapters for the terminal status in `src/server/repositories/postgres/assignment.repository.ts` and `src/server/repositories/testing/in-memory-assignment.repository.ts`

## Phase 3: User Story 1 - Mechanic Recovery (Priority: P1)

**Goal**: Assigned mechanic safely exits eligible work with one idempotent recovery.

**Independent Test**: Mechanic `cannot_continue` changes assignment/request atomically and replay returns the same response.

- [X] T006 [US1] Add mechanic ownership/state/idempotency tests in `src/features/assignments/__tests__/assignment-recovery.service.test.ts`
- [X] T007 [US1] Implement recovery transaction and sanitized audit/outbox in `src/features/assignments/assignment-recovery.service.ts`
- [X] T008 [US1] Add route contract tests in `src/features/assignments/__tests__/assignment-recovery.routes.test.ts`
- [X] T009 [US1] Add thin recover route handler and route in `src/features/assignments/assignment.route-handlers.ts` and `app/api/v1/assignments/[assignmentId]/recover/route.ts`

## Phase 4: User Story 2 - Admin Recovery (Priority: P1)

**Goal**: Admin can use bounded no-show/lost-contact reasons without weakening mechanic permissions.

**Independent Test**: Admin-only reasons succeed for admin and fail for mechanic/rider without mutation.

- [X] T010 [US2] Add admin reason and forbidden-role regression cases in `src/features/assignments/__tests__/assignment-recovery.service.test.ts`
- [X] T011 [US2] Complete role/reason enforcement in `src/features/assignments/assignment-recovery.service.ts`

## Phase 5: User Story 3 - Reliable Re-dispatch (Priority: P1)

**Goal**: Durable outbox delivery restarts dispatch exactly once using existing rules.

**Independent Test**: Replayed/concurrent handoff produces at most one active round.

- [X] T012 [US3] Add idempotent restart tests in `src/features/dispatch/__tests__/dispatch.service.test.ts`
- [X] T013 [US3] Expose recovered-request restart through existing dispatch core in `src/features/dispatch/dispatch.service.ts`
- [X] T014 [US3] Add recovery outbox consumer tests in `src/features/outbox/__tests__/outbox.worker.test.ts`
- [X] T015 [US3] Wire `assignment.recovery.requested` consumer in `src/features/outbox/outbox-consumers.ts` and `src/features/outbox/outbox.route-handlers.ts`
- [X] T016 [US3] Add PostgreSQL concurrency coverage in `src/server/repositories/postgres/__tests__/assignment-recovery.repository.integration.test.ts`

## Phase 6: Polish and Validation

- [X] T017 Update migration inventories in `src/server/db/__tests__/all-migrations.static.test.ts` and `src/server/db/__tests__/migration-lifecycle.integration.test.ts`
- [X] T018 [P] Update backend status and API documentation in `AGENTS.md` and `.env.example` if configuration changes
- [X] T019 Run focused Feature 9 unit/route/static tests and record results in `specs/014-assignment-recovery/validation.md`
- [X] T020 Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`; complete `specs/014-assignment-recovery/validation.md`

## Dependencies & Execution Order

`T001 â†’ T002`; `T003â€“T005` block services; `T006 â†’ T007 â†’ T008 â†’ T009`; `T010 â†’ T011`; `T012 â†’ T013 â†’ T014 â†’ T015 â†’ T016`; `T017â€“T020` finish the feature.

## Parallel Opportunities

- T003 and T004 modify independent contract/schema files.
- T018 is documentation-only after runtime contracts stabilize.

## Implementation Strategy

Implement tests before their matching code, keep each mutation inside UnitOfWork, validate the mechanic flow first, then admin reasons, then the outbox re-dispatch handoff.

