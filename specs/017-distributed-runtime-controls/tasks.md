# Tasks: Distributed Runtime Controls

## Phase 1: Persistence and contracts

- [x] T001 Add migration/static tests for runtime buckets and circuit states
- [x] T002 Add `202606250029_distributed_runtime_controls.sql` with atomic functions, indexes, RLS, and bounded cleanup
- [x] T003 Add runtime-control repository and awaitable limiter/circuit contracts
- [x] T004 Add in-memory repository/adapter contract coverage
- [x] T005 Add PostgreSQL repository adapters

## Phase 2: Shared controls

- [x] T006 Add hashed shared rate limiter with exact existing decision semantics
- [x] T007 Add shared provider circuit adapter with atomic failure/success/expiry behavior
- [x] T008 Add memory/postgres factories, timeout, and local fail-safe configuration
- [x] T009 Update chatbot route orchestration to await the limiter contract
- [x] T010 Update provider client to await circuit contract without changing fallback

## Phase 3: Verification

- [x] T011 Add multi-instance concurrency, TTL, failure, privacy, and factory tests
- [x] T012 Add PostgreSQL integration coverage for atomic cross-adapter behavior
- [x] T013 Update migration inventories, environment docs, and AGENTS status
- [x] T014 Run unit/DB/typecheck/lint/build gates and write validation

## Dependencies

T001→T002→T003–T005; T006–T010 depend on contracts/adapters; T011–T014 close the feature.
