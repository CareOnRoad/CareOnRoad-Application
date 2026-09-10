# Tasks: Media Signed Upload

## Phase 1: Foundation

- [x] T001 Add migration/static tests for `media_upload_intents` in `supabase/migrations/202606250025_media_upload_intents.sql` and `src/server/db/__tests__/media-upload-intent-migration.test.ts`
- [x] T002 [P] Add upload-intent repository contract, Postgres/in-memory adapters, UoW wiring, and contract tests under `src/server/repositories/**`
- [x] T003 [P] Add storage provider contract, Supabase raw-fetch adapter, fake adapter, configuration factory, and provider tests under `src/features/media-uploads/**`

## Phase 2: User Story 1 - Create Bound Intent (P1)

- [x] T004 [US1] Add strict schemas, object-key generation, MIME/size/checksum/quota validation, and tests in `src/features/media-uploads/**`
- [x] T005 [US1] Implement create-intent authorization/idempotency service with rider-owned request and mechanic-owned active assignment paths
- [x] T006 [US1] Add authenticated create-intent route/handler tests and `app/api/v1/media/upload-intents/route.ts`

## Phase 3: User Story 2 - Verify and Finalize (P2)

- [x] T007 [US2] Implement bounded provider streaming verification and mismatch/removal tests
- [x] T008 [US2] Implement transactional/replay-safe finalize into existing request/assignment metadata with sanitized audit/outbox
- [x] T009 [US2] Add finalize route and authorization/idempotency/concurrency/privacy tests

## Phase 4: User Story 3 - Cleanup (P3)

- [x] T010 [US3] Implement expired-intent leasing and orphan cleanup worker with retry-safe fake-provider tests
- [x] T011 [US3] Add protected cleanup route using existing worker-secret authority and route tests

## Phase 5: Integration and Validation

- [x] T012 Add PostgreSQL integration tests including concurrent finalize and cleanup claims
- [x] T013 Run full quality gates, apply migration `025`, and record `specs/012-media-signed-upload/validation.md`

## Dependencies

- T001-T003 block service work.
- T004 precedes T005-T006.
- T007 precedes T008-T009.
- T010 precedes T011.
- T012-T013 validate all stories.

## Independent tests

- US1: valid owner receives server-generated signed upload; override/path/authorization/quota failures receive none.
- US2: only exact byte/type/size/digest match creates one metadata record under replay and concurrency.
- US3: only expired pending exact keys are deleted and cleanup replay is harmless.
