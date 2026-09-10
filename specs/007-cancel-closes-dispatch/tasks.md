# Tasks: Cancel Request Closes Dispatch

- [X] T001 [US1] Add failing rider cancellation regression for active round/candidate closure and hidden offers in `src/features/service-requests/__tests__/service-request.service.test.ts`
- [X] T002 [US3] Add lock-order/race assertions in `src/features/assignments/__tests__/assignment-accept.concurrency.test.ts`
- [X] T003 [US1] Add `findCandidateById` and `cancelOpenDispatchForRequest` to `src/server/repositories/contracts/dispatch.repository.ts`
- [X] T004 [US1] Implement in-memory dispatch closure in `src/server/repositories/testing/in-memory-dispatch.repository.ts`
- [X] T005 [US1] Implement set-based PostgreSQL dispatch closure in `src/server/repositories/postgres/dispatch.repository.ts`
- [X] T006 [US3] Normalize offer acceptance to request-before-round-before-candidate locking in `src/features/assignments/accept-assignment.service.ts`
- [X] T007 [US1] Integrate atomic dispatch closure and active-assignment guard into rider cancel in `src/features/service-requests/service-request.service.ts`
- [X] T008 [US2] Reuse repository closure for admin cancel and preserve replay counts in `src/features/admin/admin-request-state.ts`
- [X] T009 [US2] Preserve existing admin replay/rollback/no-duplicate coverage in `src/features/admin/__tests__/admin-service-request.service.test.ts`
- [X] T010 [US3] Preserve PostgreSQL cancel/accept and admin integration coverage; external tenant validation remains blocked by `ENOTFOUND`
- [X] T011 Run focused tests and typecheck
- [X] T012 Run full unit tests, lint, build, and record focused DB environment failure

## Dependencies

T001–T002 fail before T003–T008. T003 blocks both adapters and services. T009–T010
follow implementation. T011–T012 close the feature.
