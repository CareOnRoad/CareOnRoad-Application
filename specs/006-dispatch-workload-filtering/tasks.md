# Tasks: Dispatch Active-Workload Filtering

**Input**: Design documents in `/specs/006-dispatch-workload-filtering/`

**TDD rule**: Test tasks must be implemented and observed failing before their paired production task.

## Phase 1: Repository Contract Foundation

- [X] T001 [US1] Add failing in-memory contract tests for empty input, all canonical active states, terminal states, multiple mechanics, and unknown IDs in `src/server/repositories/testing/__tests__/assignment-workload.repository.contract.test.ts`
- [X] T002 [US1] Add `MechanicActiveWorkload` and `listActiveWorkloadsByMechanicIds` to `src/server/repositories/contracts/assignment.repository.ts`
- [X] T003 [US1] Implement one-pass active workload aggregation in `src/server/repositories/testing/in-memory-assignment.repository.ts`

## Phase 2: User Story 1 - Busy Mechanics Receive No Offer (P1)

**Independent test**: A default dispatch service with one busy and one idle eligible mechanic creates an offer only for the idle mechanic.

- [X] T004 [US1] Add failing default-wiring tests for busy exclusion, terminal-only eligibility, all-busy empty results, and exactly one batch call in `src/features/dispatch/__tests__/dispatch.service.test.ts`
- [X] T005 [US1] Replace optional workload callback usage with one authoritative assignment repository batch read in `src/features/dispatch/dispatch.service.ts`
- [X] T006 [US1] Change busy filtering to positive `activeWorkloadCount` and remove duplicated active-state semantics in `src/features/dispatch/dispatch-ranking.ts`
- [X] T007 [US1] Update PostgreSQL dispatch integration coverage to persist a real active assignment and exercise the default workload path in `src/server/repositories/postgres/__tests__/dispatch.repository.integration.test.ts`
- [X] T008 [US1] Implement the single grouped workload query in `src/server/repositories/postgres/assignment.repository.ts`

## Phase 3: User Story 2 - Deterministic Production Ranking (P2)

**Independent test**: Real persisted workloads exclude busy mechanics and identical inputs produce identical ordering 100 times without injected callbacks.

- [X] T009 [US2] Add positive-count exclusion and 100-repeat deterministic ranking tests in `src/features/dispatch/__tests__/dispatch-ranking.test.ts`
- [X] T010 [US2] Replace fake workload injection with active assignment fixtures and default service construction in `src/server/repositories/postgres/__tests__/dispatch.repository.integration.test.ts`
- [X] T011 [US2] Remove fake workload injection from the 50-profile regression in `src/features/dispatch/__tests__/dispatch-performance.integration.test.ts`

## Phase 4: User Story 3 - Concurrent Changes Remain Safe (P3)

**Independent test**: A mechanic that becomes busy after ranking cannot obtain a second active assignment and no orphan row remains.

- [X] T012 [US3] Run and, only if needed, extend acceptance race coverage in `src/features/assignments/__tests__/assignment-accept.concurrency.test.ts`
- [X] T013 [US3] Attempt PostgreSQL acceptance conflict regression in `src/server/repositories/postgres/__tests__/assignment-accept.integration.test.ts`; external test tenant currently returns `ENOTFOUND`

## Phase 5: Validation and Documentation

- [X] T014 Run focused dispatch/repository tests and `npm.cmd run typecheck`
- [X] T015 Run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`
- [X] T016 Run PostgreSQL workload/dispatch/acceptance integration tests when `TEST_DATABASE_URL` is securely available and record external `ENOTFOUND` result without exposing credentials
- [X] T017 Confirm `specs/006-dispatch-workload-filtering/quickstart.md` matches final commands and behavior

## Dependencies

- T001 fails before T002–T003; T004 fails before T005–T006; T007 fails before T008.
- T002–T003 block T004–T006. T005–T008 block T009–T011.
- T012–T013 validate the unchanged final guard after T005–T011.
- T014–T017 run after all implementation tasks.

## Scope Guard

No frontend, API response, migration, dispatch radius, state-machine, chatbot,
ASR, reminder, quote, payment, audit payload, or dependency change belongs to
this feature.
