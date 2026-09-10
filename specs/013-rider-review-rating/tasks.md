# Tasks: Rider Review and Mechanic Rating

## Phase 1: Foundation

- [x] T001 Add immutable `service_reviews` migration/static tests and aggregate backfill in migration `202606250026_service_reviews.sql`
- [x] T002 [P] Add review repository contract, Postgres/in-memory adapters, UoW state/wiring, and contract tests

## Phase 2: User Story 1 - Completed Owner Review (P1)

- [x] T003 [US1] Add strict rating/comment/assignment schemas and validation tests
- [x] T004 [US1] Implement completed assignment/request ownership and self-review/admin non-bypass authorization
- [x] T005 [US1] Implement immutable create service with safe response and sanitized audit/outbox
- [x] T006 [US1] Add thin rider POST route with auth/idempotency/error mapping tests

## Phase 3: User Story 2 - Retry and Concurrency (P2)

- [x] T007 [US2] Implement create-if-absent payload replay/conflict and aggregate recomputation in one transaction
- [x] T008 [US2] Add same/different-key concurrency, idempotency conflict, privacy, and dispatch aggregate regression tests

## Phase 4: User Story 3 - Rebuild Aggregates (P3)

- [x] T009 [US3] Implement repository all-profile rebuild and worker tests including zero-review mechanics
- [x] T010 [US3] Add worker-secret-protected rebuild route and route tests

## Phase 5: Integration and Validation

- [x] T011 Add PostgreSQL integration for concurrent duplicate insert, aggregate rounding, immutable constraint, and rebuild
- [x] T012 Update mock seed aggregate ownership, run full quality gates, apply migration `026`, and record validation

## Dependencies

- T001-T002 block services.
- T003-T004 precede T005-T006.
- T007 precedes T008.
- T009 precedes T010.
- T011-T012 validate all stories.

## Independent tests

- US1: only owning rider after completed assignment/request creates one valid review.
- US2: exact concurrency yields one review/contribution/event; changed payload conflicts.
- US3: rebuild deterministically restores all aggregates, including zero-review profiles.
