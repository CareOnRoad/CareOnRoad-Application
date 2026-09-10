# Tasks: CareOnRoad Backend MVP

**Input**: Design documents from `/specs/002-careonroad-backend-mvp/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/backend-api.yaml`, `quickstart.md`

**Tests**: Tests are required in the same reviewable patch as each
implementation. PostgreSQL behavior requires migration static checks and
database-backed integration/concurrency tests where applicable. Existing
chatbot, provider, ASR, route, schema, retrieval, post-validation, rate-limit,
logger, and view-model tests remain part of every regression gate.

**Scope guard**: Do not add frontend UI, production payment settlement/refunds,
inventory commerce, odometer reminders, live tracking UI, or rebuild the
chatbot/ASR/provider/safety/fallback pipeline. Feature 002 may only add
compatible repository-backed persistence to the completed chatbot baseline.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and does not
  depend on incomplete tasks.
- **[Story]**: Maps the task to a user story from `spec.md`.
- Every implementation patch includes its tests before the implementation
  tasks in that patch.

## Phase 1: Setup

**Purpose**: Establish approved backend dependencies, environment names, and
test infrastructure without changing existing runtime behavior.

### Patch 1A - Backend dependency and test setup

- [X] T001 Obtain explicit approval for the proposed server-only `postgres` and `jose` dependencies before changing `package.json`
- [X] T002 After approval, add `postgres` and `jose` plus database-test scripts without changing existing scripts in `package.json` and `package-lock.json`
- [X] T003 [P] Add empty backend-only database, Supabase JWT, payment-fixture, and worker-secret variable names with no real values or `NEXT_PUBLIC_` prefixes in `.env.example`
- [X] T004 [P] Add shared PostgreSQL integration-test environment guards and cleanup helpers in `src/server/testing/postgres-test-context.ts`

---

## Phase 2: Foundational

**Purpose**: Add the transaction, repository, authorization, idempotency,
outbox, audit, error, and migration foundations required by all user stories.

**CRITICAL**: Complete the foundation and live PostgreSQL gate before
user-story implementation.

### Patch 1B - Database, repository, and transaction foundation

- [X] T005 [P] Add static migration-order and prohibited-secret checks in `src/server/db/__tests__/migrations.static.test.ts`
- [X] T006 [P] Add repository contract tests for transaction commit/rollback behavior in `src/server/repositories/__tests__/unit-of-work.contract.test.ts`
- [X] T007 [P] Add sanitized audit metadata tests covering tokens, API keys, raw audio, full text, contact data, and payment data in `src/features/audit/__tests__/audit-sanitizer.test.ts`
- [X] T008 Add server-only PostgreSQL configuration, client lifecycle, controlled database errors, and transaction retry helpers in `src/server/db/postgres-client.ts`, `src/server/db/transaction.ts`, and `src/server/db/database-errors.ts`
- [X] T009 Define transaction-scoped repository and unit-of-work interfaces in `src/server/repositories/contracts/unit-of-work.ts`, `src/server/repositories/contracts/idempotency.repository.ts`, `src/server/repositories/contracts/outbox.repository.ts`, and `src/server/repositories/contracts/audit.repository.ts`
- [X] T010 Add in-memory contract adapters for foundational tests in `src/server/repositories/testing/in-memory-unit-of-work.ts`, `src/server/repositories/testing/in-memory-idempotency.repository.ts`, `src/server/repositories/testing/in-memory-outbox.repository.ts`, and `src/server/repositories/testing/in-memory-audit.repository.ts`
- [X] T011 Implement PostgreSQL unit-of-work and foundational repositories in `src/server/repositories/postgres/postgres-unit-of-work.ts`, `src/server/repositories/postgres/idempotency.repository.ts`, `src/server/repositories/postgres/outbox.repository.ts`, and `src/server/repositories/postgres/audit.repository.ts`
- [X] T012 Add request hashing and actor/scope/key replay handling in `src/lib/idempotency.ts`
- [X] T013 Add stable `/api/v1` error mapping while preserving existing chatbot errors in `src/lib/api-error.ts`
- [X] T014 Add audit metadata allowlisting/redaction without weakening existing logger sanitization in `src/features/audit/audit-sanitizer.ts`
- [X] T015 Create extension, outbox, audit, idempotency, index, and deny-by-default RLS foundation SQL in `supabase/migrations/202606250001_enable_extensions.sql`, `supabase/migrations/202606250002_outbox_audit_idempotency.sql`, and `supabase/migrations/202606250003_rls_foundation.sql`
- [X] T016 Verify foundation migration apply/rollback behavior and unit-of-work
  atomicity against an isolated `careonroad_test_*` schema on the linked
  Supabase hosted PostgreSQL database in
  `src/server/db/__tests__/foundation-migrations.integration.test.ts`. Verified
  through the Supabase session pooler on 2026-06-25; the schema and fixtures are
  removed after each suite.

**Checkpoint**: Transaction-scoped repositories atomically commit domain,
idempotency, outbox, and sanitized audit work in local and isolated hosted
PostgreSQL tests.

---

## Phase 3: User Story 1 - Rider Account, Motorcycle, and Request (Priority: P1)

**Goal**: Verify actors, bootstrap application profiles, enforce ownership, and
allow riders to manage motorcycles and create idempotent coded service requests.

**Independent Test**: Bootstrap rider A from a valid JWT, create a motorcycle
and service request, replay the creation safely, then verify rider B cannot
read or mutate either resource.

### Patch 1C - Auth and application profile

- [X] T017 [P] [US1] Add JWT claim, issuer, audience, algorithm, expiry, not-before, and invalid-token unit tests in `src/server/auth/__tests__/supabase-jwt-verifier.test.ts`
- [X] T018 [P] [US1] Add profile bootstrap, role loading, suspended-user, and ownership authorization service tests in `src/features/auth/__tests__/auth.service.test.ts`
- [X] T019 [P] [US1] Add route tests for `GET /api/v1/auth/me` and `POST /api/v1/auth/profile` in `src/features/auth/__tests__/auth.routes.test.ts`
- [X] T020 [US1] Add identity and role migration with backend-owned `rider`, `mechanic`, and `admin` roles in `supabase/migrations/202606250004_identity_and_roles.sql`
- [X] T021 [US1] Define actor, profile, role, and authorization schemas in `src/features/auth/auth.types.ts`, `src/features/auth/auth.schemas.ts`, and `src/features/auth/authorization.ts`
- [X] T022 [US1] Implement Supabase JWKS verification and request actor loading in `src/server/auth/supabase-jwt-verifier.ts` and `src/server/auth/request-actor.ts`
- [X] T023 [US1] Define and implement user repository adapters in `src/server/repositories/contracts/user.repository.ts`, `src/server/repositories/testing/in-memory-user.repository.ts`, and `src/server/repositories/postgres/user.repository.ts`
- [X] T024 [US1] Implement idempotent profile bootstrap and current-actor services in `src/features/auth/auth.service.ts`
- [X] T025 [US1] Add thin auth route adapters in `app/api/v1/auth/me/route.ts` and `app/api/v1/auth/profile/route.ts`
- [X] T026 [US1] Add identity migration and repository integration tests in `src/server/repositories/postgres/__tests__/user.repository.integration.test.ts`
- [X] T112 [P] [US1] Add user-device registration and profile-bootstrap atomic sanitized audit/outbox service, route, and repository integration tests in `src/features/auth/__tests__/auth.service.test.ts`, `src/features/auth/__tests__/auth.routes.test.ts`, and `src/server/repositories/postgres/__tests__/user.repository.integration.test.ts`
- [X] T113 [US1] Add user-device registration schema/repository/service/route support and profile-bootstrap mutation-matrix behavior in `supabase/migrations/202606250005_user_devices.sql`, `src/server/repositories/contracts/user.repository.ts`, `src/server/repositories/testing/in-memory-user.repository.ts`, `src/server/repositories/postgres/user.repository.ts`, `src/features/auth/auth.service.ts`, and `app/api/v1/auth/devices/route.ts`. Migration 005 is forward-only because migration 004 was already applied to the hosted project.

### Patch 2 - Motorcycles and mechanic dispatch profiles

- [X] T027 [P] [US1] Add motorcycle ownership CRUD service and route tests, including atomic sanitized audit/outbox writes for create/update/archive and explicit protected-route assertions with stable error codes for missing/invalid auth `401`, disallowed role `403`, non-owner `403`, absent resource `404`, invalid input `400`/`422`, and valid owner success; motorcycle mutations do not require `X-Idempotency-Key`, in `src/features/motorcycles/__tests__/motorcycle.service.test.ts` and `src/features/motorcycles/__tests__/motorcycle.routes.test.ts`
- [X] T028 [P] [US1] Add mechanic profile service and route tests covering backend-owned `profile_status`, merged MVP availability, broad skills, `service_radius_km`, directly stored `latest_location`, backend-controlled `location_updated_at`, `availability_updated_at`, `rating_avg = 0`/`rating_count = 0` defaults, mechanic read-only rating behavior, no separate mechanic-location model, absence of a mechanic-editable workload counter, the 300-second dispatch-location freshness boundary, atomic sanitized audit/outbox writes, missing/invalid auth `401`, non-mechanic role `403`, absent profile `404`, invalid input `400`/`422`, stable error codes for each controlled failure, and valid mechanic success in `src/features/motorcycles/__tests__/mechanic-profile.service.test.ts` and `src/features/motorcycles/__tests__/mechanic-profile.routes.test.ts`
- [X] T029 [US1] Add motorcycles, mechanic profiles, mechanic skills, ownership constraints, RLS, `profile_status`, merged `is_available`, directly stored `latest_location`, paired/backend-controlled `location_updated_at`, `availability_updated_at`, `service_radius_km`, and constrained `rating_avg`/`rating_count` zero defaults in `supabase/migrations/202606250006_motorcycles_and_mechanics.sql`; do not add `service_reviews` or a separate mechanic-location table
- [X] T030 [US1] Define motorcycle and mechanic repository contracts and PostgreSQL/in-memory adapters, including directly stored latest-location/timestamp reads, read-only rating summary fields, no separate mechanic-location repository, and no mechanic-editable workload counter, in `src/server/repositories/contracts/motorcycle.repository.ts`, `src/server/repositories/contracts/mechanic.repository.ts`, `src/server/repositories/postgres/motorcycle.repository.ts`, `src/server/repositories/postgres/mechanic.repository.ts`, `src/server/repositories/testing/in-memory-motorcycle.repository.ts`, and `src/server/repositories/testing/in-memory-mechanic.repository.ts`
- [X] T031 [US1] Implement motorcycle schemas, ownership service, and mechanic profile service with matrix-required atomic sanitized audit/outbox writes, merged `is_available` semantics, backend-generated `location_updated_at` on location update, and explicit rejection of mechanic-supplied `profile_status`, `rating_avg`, `rating_count`, or location timestamps in `src/features/motorcycles/motorcycle.schemas.ts`, `src/features/motorcycles/motorcycle.service.ts`, and `src/features/motorcycles/mechanic-profile.service.ts`
- [X] T032 [US1] Add thin motorcycle and mechanic profile routes in `app/api/v1/motorcycles/route.ts`, `app/api/v1/motorcycles/[motorcycleId]/route.ts`, `app/api/v1/mechanics/me/profile/route.ts`, `app/api/v1/mechanics/me/availability/route.ts`, and `app/api/v1/mechanics/me/location/route.ts`
- [X] T033 [US1] Add motorcycle/mechanic migration and repository integration tests, including direct latest-location storage, backend-controlled location timestamps, 300-second freshness-boundary fixtures, rating defaults/constraints/read-only behavior, absence of separate mechanic-location storage and mechanic-editable workload counters, and atomic audit/outbox behavior for every mutation, in `src/server/repositories/postgres/__tests__/motorcycle-mechanic.repositories.integration.test.ts`

### Patch 3 - Service requests, request codes, and creation idempotency

- [X] T034 [P] [US1] Add exact Patch 3 service-type input-matrix tests, including `other` fulfillment modes (`immediate_location`, `scheduled_visit`), rejection of `fulfillment_mode` on fixed-mode service types, no implicit emergency dispatch for `other`, periodic-maintenance required future schedule with missing/past-schedule rejection and no reminder-origin path yet, location/address, transition, ownership, request-media metadata, invalid-input `400`/`422` stable-error assertions, and matrix-required atomic sanitized audit/outbox behavior in `src/features/service-requests/__tests__/service-request.service.test.ts`
- [X] T035 [P] [US1] Add request-code format, Asia/Ho_Chi_Minh date, prefix mapping, monotonic sequence, unique-conflict retry, and concurrent-allocation tests in `src/features/service-requests/__tests__/request-code.service.test.ts`
- [X] T036 [P] [US1] Add required `X-Idempotency-Key` tests for every service-request creation type, proving identical replay returns one logical request and mismatched payload returns controlled `409` with a stable error code, in `src/features/service-requests/__tests__/service-request.idempotency.test.ts`
- [X] T037 [P] [US1] Add list/read/create/cancel route contract tests with exact stable error assertions: missing/invalid auth `401`, disallowed role `403`, non-owner `403`, absent resource `404`, invalid input `400`/`422`, idempotency mismatch/state conflict `409`, and valid owner success in `src/features/service-requests/__tests__/service-request.routes.test.ts`
- [X] T038 [US1] Add service types, persisted nullable `fulfillment_mode`, service requests, request media metadata, status history, daily sequences, exact Patch 3 cross-field constraints including future-only periodic maintenance, indexes, and ownership RLS SQL in `supabase/migrations/202606250007_service_requests.sql`; do not add reminder-reference columns before Patch 7
- [X] T039 [US1] Define service-request, request-media, and request-code repository contracts with persisted `fulfillment_mode` but no Patch 3 reminder-reference fields, plus PostgreSQL/in-memory adapters in `src/server/repositories/contracts/service-request.repository.ts`, `src/server/repositories/contracts/request-code.repository.ts`, `src/server/repositories/postgres/service-request.repository.ts`, `src/server/repositories/postgres/request-code.repository.ts`, `src/server/repositories/testing/in-memory-service-request.repository.ts`, and `src/server/repositories/testing/in-memory-request-code.repository.ts`
- [X] T040 [US1] Implement the Patch 3-applicable subset of the normative FR-008 through FR-008D service-request state table, the exact category-light service-type input matrix, `fulfillment_mode` rules, Patch 3 periodic-maintenance required-future-schedule validation with no reminder-origin exception, and transactional request-code allocation in `src/features/service-requests/service-request.schemas.ts`, `src/features/service-requests/service-request-state.ts`, and `src/features/service-requests/request-code.service.ts`
- [X] T041 [US1] Implement owned create/list/read/cancel/status and request-media metadata workflows with request history, required idempotency for every creation type, controlled `409` stable error on payload mismatch, invalid fulfillment/schedule `400`/`422` rejection, and matrix-required atomic sanitized outbox/audit writes; cancellation must lock the service-request row and re-check status transactionally before commit in `src/features/service-requests/service-request.service.ts`
- [X] T042 [US1] Add thin service-request routes in `app/api/v1/service-requests/route.ts`, `app/api/v1/service-requests/[requestId]/route.ts`, `app/api/v1/service-requests/[requestId]/cancel/route.ts`, and `app/api/v1/service-requests/[requestId]/media/route.ts`
- [X] T043 [US1] Add database-backed request-code concurrency, both valid `other` fulfillment modes, invalid fulfillment combinations, Patch 3 future-only periodic-maintenance validation, transactional cancellation locking/status re-check, media metadata, all-service-type idempotency with mismatched-payload `409` stable errors, ownership, and atomic sanitized outbox/audit integration tests in `src/server/repositories/postgres/__tests__/service-request.repository.integration.test.ts`

**Checkpoint**: User Story 1 is independently usable through backend APIs with
verified identity, ownership, request codes, and replay-safe creation.

---

## Phase 4: User Story 2 - Atomic Dispatch and Assignment (Priority: P1)

**Goal**: Persist ranked dispatch candidates and guarantee that the first valid
mechanic accept wins without double-assigning a request or mechanic.

**Independent Test**: Seed one request and two eligible mechanics, run
concurrent accepts, and verify one assignment, one accepted candidate, canceled
competitors, request/history updates, outbox, and audit.

### Patch 4A - Dispatch candidate generation and lifecycle

- [X] T044 [P] [US2] Add deterministic candidate eligibility tests for `profile_status = active`, merged `is_available`, matching broad skill, active-conflict assignment exclusion, and fresh latest location, plus ordering tests for nearest distance, higher `rating_avg`, `rating_count = 0` compatibility, earliest `availability_updated_at`, final `mechanic_user_id` tie-breaker, radius steps, batch size, missing-location exclusion, and stale-location exclusion at the `location_max_age_seconds = 300` freshness boundary in `src/features/dispatch/__tests__/dispatch-ranking.test.ts`
- [X] T045 [P] [US2] Add exact 60-second offer expiry, four-round `[2,5,8,12]` km expansion, 360-second total wait, rejection, cancellation, manual escalation, active-conflict states, and atomic candidate audit/outbox tests in `src/features/dispatch/__tests__/dispatch.service.test.ts`
- [X] T046 [P] [US2] Add dispatch and mechanic-offer route tests asserting missing/invalid auth `401`, disallowed role `403`, non-owner/non-candidate `403`, absent resource `404`, active assignment/job conflict `409` with stable codes, and success only for allowed rider/mechanic ownership boundaries in `src/features/dispatch/__tests__/dispatch.routes.test.ts`
- [X] T047 [US2] Add dispatch rounds/candidates with the closed exact candidate enum `pending|offered|accepted|rejected|expired|cancelled`, expiry/index constraints, and mechanic-visible RLS SQL in `supabase/migrations/202606250008_dispatch_candidates.sql`; any future candidate status requires a spec and migration amendment
- [X] T048 [US2] Define dispatch repository contract and PostgreSQL/in-memory adapters in `src/server/repositories/contracts/dispatch.repository.ts`, `src/server/repositories/postgres/dispatch.repository.ts`, and `src/server/repositories/testing/in-memory-dispatch.repository.ts`
- [X] T049 [US2] Implement the deterministic dispatch constants including `location_max_age_seconds = 300`; candidate eligibility requiring active/available profile, matching broad skill, fresh latest location, and no active-conflict assignment; candidate ordering by nearest distance, higher `rating_avg` with zero-count tolerance, earliest `availability_updated_at`, then `mechanic_user_id`; the closed exact candidate-status enum; active-job conflict states; bounded rounds; offer lifecycle; manual escalation; and matrix-required atomic sanitized audit/outbox writes in `src/features/dispatch/dispatch.schemas.ts`, `src/features/dispatch/dispatch-ranking.ts`, and `src/features/dispatch/dispatch.service.ts`
- [X] T050 [US2] Add thin dispatch routes in `app/api/v1/service-requests/[requestId]/dispatch/route.ts`, `app/api/v1/dispatch/offers/route.ts`, and `app/api/v1/dispatch/offers/[offerId]/decline/route.ts`
- [X] T051 [US2] Add database-backed deterministic candidate eligibility and ordering coverage for active/available profile, matching broad skill, active-conflict assignment exclusion, nearest distance, higher `rating_avg`, `rating_count = 0`, earliest `availability_updated_at`, final `mechanic_user_id`, and missing/stale-location exclusion at 300 seconds, plus exact candidate-enum constraints, uniqueness, expiry, round/total-wait limits, active-job conflicts with controlled `409` stable errors, escalation, and atomic audit/outbox integration tests in `src/server/repositories/postgres/__tests__/dispatch.repository.integration.test.ts`

### Patch 4B - Atomic mechanic accept and assignment workflow

- [X] T052 [P] [US2] Add assignment transition, active-conflict-state, assigned-mechanic/admin authorization, route, and atomic history/audit/outbox tests with exact missing/invalid auth `401`, disallowed role `403`, non-owner/unassigned actor `403`, absent resource `404`, valid assigned-mechanic/admin success, and controlled active-assignment/active-job `409` stable error codes in `src/features/assignments/__tests__/assignment.service.test.ts` and `src/features/assignments/__tests__/assignment.routes.test.ts`
- [X] T053 [US2] Add service-level concurrent two-mechanic/one-request, one-mechanic/two-request, and rider-cancel-versus-mechanic-accept tests for both commit orders, proving the losing operation leaves no inconsistent assignment, candidate, history, audit, or outbox state in `src/features/assignments/__tests__/assignment-accept.concurrency.test.ts`
- [X] T054 [US2] Add assignments, assignment history, active-request/mechanic partial unique indexes, candidate identity checks, and RLS SQL in `supabase/migrations/202606250009_assignments.sql`
- [X] T055 [US2] Define assignment repository contract and PostgreSQL/in-memory adapters in `src/server/repositories/contracts/assignment.repository.ts`, `src/server/repositories/postgres/assignment.repository.ts`, and `src/server/repositories/testing/in-memory-assignment.repository.ts`
- [X] T056 [US2] Implement the atomic accept transaction that locks candidate, then locks and re-checks the shared service-request row, mechanic, and active assignments, enforces cancel-versus-accept and exact active-conflict semantics, and creates assignment/history/candidate/sanitized outbox/audit writes in `src/features/assignments/accept-assignment.service.ts`
- [X] T057 [US2] Implement and test only the Patch 4-applicable subset of the normative FR-008 through FR-008D assignment/request transition tables and actor checks, with matrix-required atomic status-history, sanitized audit, and outbox writes in `src/features/assignments/assignment-state.ts` and `src/features/assignments/assignment.service.ts`
- [X] T058 [US2] Add thin accept/list/status routes in `app/api/v1/dispatch/offers/[offerId]/accept/route.ts`, `app/api/v1/assignments/route.ts`, and `app/api/v1/assignments/[assignmentId]/status/route.ts`
- [X] T059 [US2] Add database-backed lock, active-conflict-state, unique-index, rollback, sanitized outbox/audit, assignment-transition, first-valid-accept, and cancel-versus-accept integration tests for both commit orders, proving no canceled request coexists with an active assignment and no losing-transaction residue remains, in `src/server/repositories/postgres/__tests__/assignment-accept.integration.test.ts`

**Checkpoint**: Dispatch and assignment are backend-only, race-safe, and
independently testable with seeded prerequisites.

**Operational deployment status**: Migrations
`202606250008_dispatch_candidates.sql` and
`202606250009_assignments.sql` passed isolated PostgreSQL schema tests.
Isolated-schema tests do not prove hosted/dev application-schema deployment.
Before enabling Patch 4 APIs against hosted/dev application data, migrations
008 and 009 must be applied and verified there in order.

---

## Phase 5: User Story 3 - Mechanic Diagnosis and Quote (Priority: P1)

**Goal**: Let the assigned mechanic record text-first findings and issue
immutable, server-calculated quote versions for rider approval or rejection.

**Independent Test**: Record a diagnosis, create quote versions 1 and 2, reject
stale approval of version 1, approve version 2, and reject edits to the decided
quote.

### Patch 5 - Mechanic diagnosis and immutable quote versions

**Status**: Explicitly authorized by the user and completed through T068.

- [X] T060 [P] [US3] Add tests seeded only with assignment status `on_site` or `diagnosis` for at most one current diagnosis per assignment; assigned-mechanic/admin create and pre-quote revision; no implicit assignment/request transition from diagnosis mutation; concurrent revision locking and assignment/diagnosis state re-check; post-quote revision rejection; and atomic sanitized audit/outbox behavior that excludes full diagnosis text in `src/features/mechanic-diagnosis/__tests__/mechanic-diagnosis.service.test.ts`
- [X] T061 [P] [US3] Add quote total, overflow, immutable-version update, supersede, and synchronized-state tests: first quote requires assignment `diagnosis` and request `in_service` then moves them to `quoted`/`awaiting_quote_approval`; later versions preserve those states; latest approval moves both to `awaiting_payment` without creating payment; rejection preserves `quoted`/`awaiting_quote_approval`; stale approval returns controlled `409`; validation `400`/`422`, ownership, and atomic sanitized audit/outbox behavior cover create/approve/reject in `src/features/quotes/__tests__/quote.service.test.ts`
- [X] T062 [P] [US3] Add diagnosis and quote route contract tests asserting missing/invalid auth `401`, disallowed role `403`, non-owner/unassigned actor `403`, absent resource `404`, diagnosis outside `on_site|diagnosis` and stale quote/version conflicts as `409` with stable codes, invalid input `400`/`422`, synchronized quote state behavior, no payment initiation, and valid actor success within assignment/ownership boundaries in `src/features/quotes/__tests__/diagnosis-quote.routes.test.ts`
- [X] T063 [US3] Add mechanic diagnoses, quotes, quote lines, version constraints, amount checks, indexes, and RLS SQL in `supabase/migrations/202606250010_diagnoses_and_quotes.sql`
- [X] T064 [US3] Define diagnosis/quote repository contracts and PostgreSQL/in-memory adapters in `src/server/repositories/contracts/diagnosis.repository.ts`, `src/server/repositories/contracts/quote.repository.ts`, `src/server/repositories/postgres/diagnosis.repository.ts`, `src/server/repositories/postgres/quote.repository.ts`, `src/server/repositories/testing/in-memory-diagnosis.repository.ts`, and `src/server/repositories/testing/in-memory-quote.repository.ts`
- [X] T065 [US3] Implement at most one current diagnosis per assignment; assigned-mechanic/admin create and pre-quote revision only in `on_site` or `diagnosis`; no implicit assignment/request transition from diagnosis mutation; locked assignment/diagnosis re-check for concurrent revisions; immutability after any quote version references the diagnosis; and matrix-required atomic sanitized audit/outbox writes that omit full diagnosis text in `src/features/mechanic-diagnosis/mechanic-diagnosis.schemas.ts` and `src/features/mechanic-diagnosis/mechanic-diagnosis.service.ts`
- [X] T066 [US3] Implement server-side quote calculations, locked version allocation, immutable updates through new versions, and synchronized assignment/request state effects: first quote `diagnosis|in_service -> quoted|awaiting_quote_approval`, later versions preserve those states, approval moves both to `awaiting_payment` without creating payment, and rejection preserves `quoted|awaiting_quote_approval`; implement latest-pending rider decisions and matrix-required atomic history/sanitized audit/outbox writes in `src/features/quotes/quote.schemas.ts`, `src/features/quotes/quote-calculator.ts`, and `src/features/quotes/quote.service.ts`
- [X] T067 [US3] Add thin diagnosis and quote routes in `app/api/v1/assignments/[assignmentId]/diagnoses/route.ts`, `app/api/v1/service-requests/[requestId]/quotes/route.ts`, `app/api/v1/quotes/[quoteId]/approve/route.ts`, and `app/api/v1/quotes/[quoteId]/reject/route.ts`
- [X] T068 [US3] Add database-backed diagnosis authorization/state locking, quote version/concurrency, synchronized assignment/request state, no-payment-on-approval/rejection, rollback-residue, and matrix-required atomic sanitized audit/outbox integration tests in `src/server/repositories/postgres/__tests__/diagnosis-quote.repositories.integration.test.ts`

**Checkpoint**: User Story 3 is independently testable with a seeded assignment
in `on_site` or `diagnosis` and produces no AI-authored final diagnosis or
price.

---

## Phase 6: User Story 4 - Idempotent Payment Adapter Flow (Priority: P2)

**Goal**: Provide mock/sandbox payment orders and verified webhook processing
without production checkout, settlement, client-authoritative success, or
refunds.

**Independent Test**: Create one order idempotently, reject a client success
claim and invalid signature, process one verified fixture, replay it, and
verify one logical transition.

### Patch 6 - Mock/sandbox payment adapter and verified webhook

- [X] T069 [P] [US4] Add provider-neutral payment adapter and fixture tests in `src/features/payments/__tests__/payment-provider.test.ts`
- [X] T070 [P] [US4] Add payment-order `X-Idempotency-Key` tests for owner scope, same-payload replay, mismatched-payload `409`, quote amount/currency copy, terminal-state rejection, and sanitized audit/outbox writes in `src/features/payments/__tests__/payment.service.test.ts`
- [X] T071 [P] [US4] Add signed payOS webhook tests for invalid signature, provider-event dedupe, amount/currency mismatch to `needs_review`, unmatched provider reference, matched success/failure/cancel events, duplicate-event no-op behavior, and sanitized audit/outbox writes in `src/features/payments/__tests__/payment.service.test.ts`
- [X] T072 [P] [US4] Add payment order/read/cancel/webhook/reconcile route tests using fixtures only in `src/features/payments/__tests__/payment.routes.test.ts`
- [X] T073 [US4] Add payment orders/events, closed status enum, provider-event uniqueness, quote amount checks, indexes, and RLS SQL without refund structures in `supabase/migrations/202606250020_payments.sql`
- [X] T074 [US4] Define payment repository contract and PostgreSQL/in-memory adapters in `src/server/repositories/contracts/payment.repository.ts`, `src/server/repositories/postgres/payment.repository.ts`, and `src/server/repositories/testing/in-memory-payment.repository.ts`
- [X] T075 [US4] Implement provider-neutral interfaces and payOS runtime adapter in `src/features/payments/payment-provider.ts`, `src/features/payments/payos.client.ts`, and `src/features/payments/payos-signature.ts`
- [X] T076 [US4] Implement payment status transitions, scoped idempotency, webhook dedupe, `needs_review`, succeeded-payment prerequisite for `awaiting_payment -> in_progress`, and sanitized audit/outbox writes in `src/features/payments/payment.service.ts`
- [X] T077 [US4] Add thin payment routes in `app/api/v1/payments/orders/route.ts`, `app/api/v1/payments/orders/[paymentOrderId]/route.ts`, `app/api/v1/payments/orders/[paymentOrderId]/cancel/route.ts`, `app/api/v1/payments/webhooks/payos/route.ts`, and `app/api/v1/internal/workers/payments/reconcile/route.ts`
- [X] T078 [US4] Add database-backed payment repository and migration coverage for idempotent order creation, webhook dedupe, succeeded-payment assignment gating, and no refund/settlement schema.

**Checkpoint**: Payment behavior is provider-neutral, fixture-driven, and has
no production fund movement or refund workflow.

---

## Phase 7: User Story 5 - Date/Time-Based Reminders, Not Odometer-Based (Priority: P2)

**Goal**: Manage owned date/time-based, not odometer-based reminder rules and
deduplicate due occurrences under concurrent workers.

**Independent Test**: Create and snooze a rule, run concurrent due-rule claims,
and verify one occurrence and one logical reminder job/outbox intent.

### Patch 7A - Reminder rules, occurrences, and worker

- [X] T079 [P] [US5] Add owned create/list/update/snooze/disable rule tests, reject odometer fields, verify matrix-required atomic sanitized audit/outbox writes, and add reminder-originated periodic-maintenance service-request tests proving the request starts as `submitted`, only an owned due occurrence for the selected motorcycle may omit `scheduled_start_at`, and ownership plus required `X-Idempotency-Key` replay/mismatch behavior remains identical to other service-request creation in `src/features/reminders/__tests__/reminder.service.test.ts` and `src/features/reminders/__tests__/reminder-service-request.service.test.ts`
- [X] T080 [P] [US5] Add due-time, snooze, recurrence, retry, concurrent occurrence deduplication, reminder-job generated/queued, and atomic audit/outbox tests in `src/features/reminders/__tests__/reminder.worker.test.ts`
- [X] T081 [P] [US5] Add reminder, reminder-originated service-request, and protected worker route tests asserting missing/invalid rider auth `401`, disallowed role `403`, non-owner `403`, absent resource `404`, invalid input `400`/`422`, non-due/state conflict `409`, stable error codes for each controlled failure, valid owner success, and invalid/missing worker secret `401` with stable error codes in `src/features/reminders/__tests__/reminder.routes.test.ts` and `src/features/reminders/__tests__/reminder-service-request.routes.test.ts`
- [X] T082 [US5] Add reminder rules/occurrences, `(rule_id,due_at)` uniqueness, due indexes, ownership RLS, and Patch 7 `service_requests.reminder_id`/`reminder_context_id` columns with applicable foreign keys and consistency constraints in `supabase/migrations/202606250011_reminders.sql`
- [X] T083 [US5] Define reminder repository contract and PostgreSQL/in-memory adapters that can lock and validate an owned due occurrence for a selected motorcycle, in `src/server/repositories/contracts/reminder.repository.ts`, `src/server/repositories/postgres/reminder.repository.ts`, and `src/server/repositories/testing/in-memory-reminder.repository.ts`
- [X] T084 [US5] Implement date/time-based, not odometer-based reminder schemas with no odometer or kilometer fields, ownership workflows, snooze, disable, recurrence, and the Patch 7 reminder-originated periodic-maintenance creation path through the existing service-request workflow so the request starts as `submitted`, persists `reminder_id`/`reminder_context_id`, permits omitted `scheduled_start_at` only for an owned due occurrence tied to the selected motorcycle, retains required ownership and `X-Idempotency-Key` semantics, rejects non-due/cross-rider/mismatched references with exact `403`/`404`/`409` stable errors, and writes required domain/history/audit/outbox rows atomically in `src/features/reminders/reminder.schemas.ts`, `src/features/reminders/reminder.service.ts`, and `src/features/service-requests/service-request.service.ts`
- [X] T085 [US5] Implement leased due-rule claim, deduplicated occurrence creation, and atomic reminder-job audit/outbox writes in `src/server/workers/reminder.worker.ts`
- [X] T086 [US5] Add thin reminder and protected worker routes in `app/api/v1/reminders/route.ts`, `app/api/v1/reminders/[reminderId]/route.ts`, `app/api/v1/reminders/[reminderId]/snooze/route.ts`, and `app/api/v1/internal/workers/reminders/run/route.ts`
- [X] T087 [US5] Add database-backed concurrent reminder worker, occurrence uniqueness, idempotent reminder-originated periodic-maintenance creation with valid owned due occurrence, mismatched-payload `409`, non-due/cross-rider/motorcycle-mismatch rejection, persisted reminder references, and matrix-required atomic sanitized audit/outbox integration tests in `src/server/repositories/postgres/__tests__/reminder.repository.integration.test.ts`

**Checkpoint**: Date/time-based, not odometer-based reminders are race-safe and
contain no odometer or kilometer logic.

---

## Phase 8: User Story 6 - Reliable Outbox and Audit (Priority: P2)

**Goal**: Persist notifications, deliver outbox events with leases/retries, and
retain append-only sanitized audit records for core mutations.

**Independent Test**: Commit a domain mutation with outbox/audit, simulate
delivery failure and lease expiry, retry it, and verify no duplicate domain
work or prohibited audit data.

### Patch 7B - Notifications, outbox worker, and audit hardening

**Status**: Explicitly authorized and completed through T096. Payment is
implemented separately in feature 005.

- [X] T088 [P] [US6] Add notification creation, sent/failed status, stable dedupe, atomic audit, creation outbox, and no-recursive-outbox delivery-status tests in `src/features/notifications/__tests__/notification.service.test.ts`
- [X] T089 [P] [US6] Add outbox lease, retry/backoff, success, crash recovery, dead-letter, notification sent/failed audit, and no-recursive-outbox tests in `src/features/outbox/__tests__/outbox.worker.test.ts`
- [X] T090 [P] [US6] Add append-only audit and prohibited-metadata integration tests in `src/features/audit/__tests__/audit.integration.test.ts`
- [X] T091 [US6] Add notifications, delivery indexes, outbox lease constraints, audit append-only protections, and RLS SQL in `supabase/migrations/202606250012_notifications_outbox_audit.sql`
- [X] T092 [US6] Define notification repository contract and PostgreSQL/in-memory adapters in `src/server/repositories/contracts/notification.repository.ts`, `src/server/repositories/postgres/notification.repository.ts`, and `src/server/repositories/testing/in-memory-notification.repository.ts`
- [X] T093 [US6] Implement in-app notification creation with atomic sanitized audit/outbox writes and outbox-topic consumers whose sent/failed status updates write audit but no recursive outbox event in `src/features/notifications/notification.service.ts` and `src/features/outbox/outbox-consumers.ts`
- [X] T094 [US6] Implement leased outbox claim, retry/backoff, processed, dead-letter, and atomic notification delivery-status audit behavior in `src/server/workers/outbox.worker.ts`
- [X] T095 [US6] Add the protected outbox worker route, worker-secret verification, and route tests proving missing/invalid worker secrets return controlled `401` responses with stable error codes, non-worker bearer actors cannot run it, and valid worker authority succeeds in `app/api/v1/internal/workers/outbox/run/route.ts`, `src/server/auth/worker-secret.ts`, and `src/features/outbox/__tests__/outbox.routes.test.ts`
- [X] T096 [US6] Add database-backed mutation-matrix atomic domain/outbox/audit, sanitized payload, notification no-recursion, and lease-recovery tests in `src/server/repositories/postgres/__tests__/outbox-audit.integration.test.ts`

**Checkpoint**: Core mutations and asynchronous delivery are auditable,
sanitized, and recoverable.

---

## Phase 9: User Story 7 - Durable Chatbot History Without Behavior Changes (Priority: P2)

**Goal**: Persist existing chatbot sessions, messages, and validated diagnosis
results while preserving the in-memory adapter and every current route,
provider, safety, ASR, fallback, rate-limit, schema, and logging behavior.

**Independent Test**: Use the existing chatbot APIs to create a session and
diagnosis, restart with PostgreSQL retained, restore the latest result through
the unchanged route, and run the complete existing regression suite.

### Patch 8 - Compatible chatbot persistence adapter

**Status**: Explicitly authorized and completed through T105.

- [X] T097 [P] [US7] Add chatbot repository contract tests proving parity between in-memory and PostgreSQL adapters plus atomic metadata-only sanitized audit/outbox behavior in `src/server/repositories/__tests__/chatbot-session.repository.contract.test.ts`
- [X] T098 [P] [US7] Add restart-persistence, unchanged response-contract, and atomic session/message/diagnosis audit/outbox tests through existing APIs in `src/features/chatbot/__tests__/chatbot-persistence.integration.test.ts`
- [X] T099 [P] [US7] Add regression tests proving normal and fallback responses remain Vietnamese; diagnosis remains advisory only; estimated prices remain advisory estimates; chatbot output cannot initiate assignment, quote approval, or payment; dangerous-symptom safety overrides remain enforced; Gemini-to-OpenRouter-to-local-fallback order remains unchanged; provider-failure and invalid-JSON fallback remain unchanged; local ASR remains local; and raw-audio isolation, rate limits, public response contracts, and log redaction remain unchanged in `src/features/chatbot/__tests__/feature-002-regression.test.ts`
- [X] T100 [US7] Add chatbot sessions/messages/diagnosis results, latest-result index, anonymous-session support, and no-raw-audio schema SQL in `supabase/migrations/202606250013_chatbot_persistence.sql`
- [X] T101 [US7] Define the compatible chatbot session repository contract and PostgreSQL adapter in `src/server/repositories/contracts/chatbot-session.repository.ts` and `src/server/repositories/postgres/chatbot-session.repository.ts`
- [X] T102 [US7] Adapt the existing in-memory implementation to the repository contract without removing its local/test availability in `src/features/chatbot/session.store.ts`
- [X] T103 [US7] Add repository selection/configuration with memory and PostgreSQL modes in `src/server/repositories/chatbot-session-repository.factory.ts`
- [X] T104 [US7] Integrate repository-backed session/message/validated-diagnosis writes, matrix-required atomic metadata-only sanitized audit/outbox writes, and latest-diagnosis reads with minimal additive changes in `src/features/chatbot/api-routes.ts` and `src/features/chatbot/diagnosis.service.ts`
- [X] T105 [US7] Add database-backed chatbot persistence tests proving atomic audit/outbox behavior and that raw audio, provider secrets, and full chatbot text are not stored in audit/outbox payloads in `src/server/repositories/postgres/__tests__/chatbot-session.repository.integration.test.ts`

**Checkpoint**: Chatbot history survives restart with no public or behavioral
change, and the memory adapter remains available.

---

## Phase 10: Polish and Cross-Cutting Validation

**Purpose**: Complete migration, security, performance, and full regression
gates after all desired user stories are implemented.

### Patch 9 - Hardening and operational validation

**Status**: Explicitly authorized and completed through T118 (T106-T111 and
T114-T118). Payment is implemented separately in feature 005.

- [X] T106 [P] Add final indexes, foreign-key consistency checks, retention-support indexes, and complete RLS policies in `supabase/migrations/202606250014_indexes_constraints_rls.sql`
- [X] T107 [P] Add migration naming/order, enum/status coverage, required unique indexes, RLS enablement, and forbidden refund/odometer schema checks in `src/server/db/__tests__/all-migrations.static.test.ts`
- [X] T108 Add full clean-reset and sequential-upgrade migration tests in `src/server/db/__tests__/migration-lifecycle.integration.test.ts`
- [X] T109 [P] Add local regression smoke checks using 50 deterministic mechanic profiles, including 10 active assignments plus missing/stale-location fixtures, and five concurrent accept pairs; require candidate generation and the contested-assignment scenario to each complete within a generous 30-second threshold with no deadlock residue or invariant violation, without making production p95, capacity, or readiness claims, in `src/features/dispatch/__tests__/dispatch-performance.integration.test.ts`
- [X] T110 Run and record `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run build` results in `specs/002-careonroad-backend-mvp/quickstart.md`
- [X] T111 Verify the implementation contains no frontend changes, real payment credentials/settlement/refunds, odometer logic, raw-audio remote calls, or chatbot/ASR rewrites and record the scope audit in `specs/002-careonroad-backend-mvp/checklists/implementation-scope.md`
- [X] T114 [P] Add local auth/profile and representative CRUD regression smoke checks using 20 deterministic operations that complete within a generous 30-second threshold in the configured test environment, without production benchmark infrastructure or p95 claims, in `src/features/auth/__tests__/auth-crud-performance.smoke.test.ts`
- [X] T115 [P] Add worker peer-claim non-blocking regression smoke checks using two peers and 20 deterministic leased events; require both peers to make progress and complete within a generous 30-second threshold in the configured test environment, in `src/features/outbox/__tests__/worker-nonblocking.smoke.test.ts`
- [X] T116 [P] Add chatbot latency regression smoke checks using 20 deterministic mocked-provider requests before and after repository-backed persistence; require persistence median latency to remain within 250 milliseconds or three times the in-memory baseline, whichever allowance is greater, without making a production p95 claim, in `src/features/chatbot/__tests__/chatbot-latency.smoke.test.ts`
- [X] T117 [P] Scan committed files and fixtures for service-role keys, API keys, bearer tokens, payment secrets, and inappropriate raw-audio fixtures; verify `/api/v1` responses and audit/outbox payloads omit secrets and full private text; verify frontend bundles expose no server-only variables; and record evidence in `specs/002-careonroad-backend-mvp/checklists/secret-isolation.md`
- [X] T118 [P] Add JWT algorithm-policy hardening tests for the configured JWKS allowlist, `none`, `HS256` rejection on the JWKS path, unsupported algorithms, key/algorithm mismatch, algorithm-confusion attempts, and disabled implicit legacy fallback in `src/server/auth/__tests__/supabase-jwt-verifier.test.ts`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1 Setup** has no dependencies.
- **Phase 2 Foundation** depends on Phase 1 and blocks live-database-dependent
  user-story work. T016 is complete against the linked hosted test-schema flow.
- **US1** depends on Phase 2; its internal order is auth, motorcycles/mechanic
  profiles, then service requests.
- **US2** depends on US1 motorcycles, mechanic profiles, and service requests.
- **US3** depends on US2 assignments.
- **US4** depends on US3 approved quotes.
- **US5** depends on US1 motorcycle ownership and Phase 2 foundations.
- **US6** depends on Phase 2 foundations and can be completed alongside US4 or
  US5, but its final integration test uses mutations from completed stories.
- **US7** depends only on Phase 2 and can run in parallel with US2-US6 after the
  repository foundation is stable.
- **Phase 10** depends on all selected user-story phases.

### User Story Completion Order

```text
Setup -> Foundation -> US1 -> US2 -> US3 -> US4
                         |       |
                         +-> US5 +-> US6
Foundation -----------------------------> US7
US1-US7 --------------------------------> Hardening
```

### Reviewable Patch Order

1. **Patch 1**: T001-T026 plus T112-T113 - dependencies, DB/repository
   foundation, auth/profile, device registration, and mutation-matrix coverage.
2. **Patch 2**: T027-T033 - motorcycles and mechanic dispatch profiles.
3. **Patch 3**: T034-T043 - service requests, request codes, idempotency.
4. **Patch 4**: T044-T059 - dispatch candidates and atomic assignments.
5. **Patch 5**: T060-T068 - mechanic diagnosis and versioned quotes.
6. **Patch 6**: T069-T078 - mock/sandbox payment adapter and verified webhook.
7. **Patch 7**: T079-T096 - date/time-based, not odometer-based reminders,
   notifications, outbox, audit.
8. **Patch 8**: T097-T105 - existing chatbot persistence integration only.
9. **Patch 9**: T106-T111 plus T114-T118 - RLS, migration lifecycle,
   performance smoke checks, regression, and scope validation.

Each patch includes its own focused tests and must pass existing tests before
review.

## Parallel Opportunities

- T003 and T004 can run after dependency approval while T002 updates package
  metadata.
- Foundational tests T005-T007 can be prepared in parallel.
- Within US1, auth tests T017-T019 are parallel; motorcycle tests T027-T028 are
  parallel; service-request tests T034-T037 are parallel.
- US2 dispatch tests T044-T046 are parallel; assignment service tests T052 can
  be prepared while the database concurrency harness for T053 is built.
- US3 tests T060-T062 are parallel.
- US4 tests T069-T072 are parallel and use only mock/sandbox fixtures.
- US5 tests T079-T081 are parallel.
- US6 tests T088-T090 are parallel.
- US7 contract, persistence, and non-regression tests T097-T099 are parallel.
- Patch 9 smoke, secret-isolation, and JWT hardening checks T114-T118 are
  parallel after their
  prerequisite modules exist.
- After Foundation and US1, US5 and US7 may proceed independently while the
  sequential dispatch -> quote -> payment chain is implemented.

## Parallel Example: User Story 2

```text
Task T044: candidate ranking tests
Task T045: bounded-round and lifecycle tests
Task T046: dispatch route tests

After dispatch candidates exist:
Task T052: assignment state/authorization tests
Task T053: concurrent accept test harness
```

## Parallel Example: User Story 7

```text
Task T097: memory/PostgreSQL repository contract tests
Task T098: restart persistence route test
Task T099: completed-baseline regression tests
```

## Implementation Strategy

### Current Status

Patches 1-5 are complete through T068 plus T112-T113. Patch 5 was explicitly
authorized and completed through T068. Payment is implemented separately in
feature 005. Patch 7A is completed through T087, and Patch 7B is completed
through T096. Patch 8 is completed through T105. Patch 9 is completed through
T118 (T106-T111 and T114-T118).

### Remaining MVP

Remaining backend MVP work in this task file is complete; payment follow-up
planning and validation live in `specs/005-careonroad-payment/`.

## Completion Rules

- Tests are written before implementation and fail for the intended missing
  behavior.
- Every state-changing service uses actor checks and a unit-of-work transaction.
- Every state-changing service and integration test follows the plan's
  mutation-to-audit/outbox matrix; privacy-sensitive values are sanitized
  before persistence, and read-only operations require neither record.
- Database constraints backstop concurrency-sensitive application checks.
- Routes under `app/api/v1/**` remain thin adapters.
- No task adds frontend UI.
- No task adds production payment settlement or refunds.
- No task adds odometer/kilometer reminder logic.
- No task rebuilds chatbot, voice, local ASR, providers, safety, fallback,
  retrieval, schema validation, post-validation, rate limiting, or logging.
- Existing tests and each patch's new focused tests pass before review.
- T016 must remain green before database integration is declared
  production-ready or merged.
