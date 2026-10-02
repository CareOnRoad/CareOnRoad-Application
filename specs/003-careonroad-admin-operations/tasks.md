# Tasks: CareOnRoad Admin Operations

**Input**: Design documents from
`/specs/003-careonroad-admin-operations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/admin-api.yaml, quickstart.md

**Tests**: Required. Each patch writes focused route/service/repository tests
before or with implementation and retains the full regression suite.

**Organization**: Tasks are grouped by user story. Patch A is shared foundation;
Patches B-J map to the prioritized user stories below.

Implementation reconciliation (03/10/2026): Patches A–I and explicitly authorized J are
implemented in role-flow Batches 00–15; local acceptance results and remaining
provider/device/production gates are recorded in the root batch report. Tests are consolidated rather than copied per planned
filename. See root BACKEND-FIX-BATCHES-REPORT.md and
apps/api/ADMIN-RECOVERY-OPERATIONS.md for scope, policies and evidence.

## Patch-to-Task Index

| Patch | Task IDs | User story |
|---|---|---|
| A - Foundation | T001-T018 | Shared setup/foundation |
| B - User management | T019-T035 | US1 |
| C - Mechanic management | T036-T050 | US2 |
| D - Service-request operations | T051-T064 | US3 |
| E - Dispatch operations | T065-T083 | US3 |
| F - Assignment operations | T084-T097 | US4 |
| G - Diagnosis/quote supervision | T098-T111 | US4 |
| H1 - Audit/notification/outbox | T112-T132 | US5 |
| H2 - Reminder operations | T133-T143 | US6 |
| I - Dashboard | T144-T154 | US7 |
| J - Optional configuration | T155-T166 | US8 |
| Final verification | T167-T175 | Cross-cutting |

## Phase 1: Setup - Patch A Contract and Test Scaffolding

**Purpose**: Lock the admin API boundary, test utilities, and prohibited scope
before adding persistence or commands.

- [x] T001 Validate and freeze the feature contract operation IDs and mutation headers in specs/003-careonroad-admin-operations/contracts/admin-api.yaml
- [x] T002 Create shared admin test actor, JWT verifier, request, idempotency-key, and response helpers in src/features/admin/__tests__/admin-route-test-helpers.ts
- [x] T003 [P] Add static contract tests for every `/api/v1/admin` mutation requiring reason and `X-Idempotency-Key` in src/features/admin/__tests__/admin-api-contract.test.ts
- [x] T004 [P] Add static scope tests prohibiting payment, frontend, Maps, tracking, odometer, force-status, and rating-setter artifacts in src/features/admin/__tests__/admin-scope.static.test.ts

---

## Phase 2: Foundational - Patch A Authorization, Schemas, Redaction, Notes

**Purpose**: Shared infrastructure that blocks every admin user story.

**Checkpoint**: No domain-specific admin command route is enabled until all
foundation tests pass.

- [x] T005 [P] Write authorization tests for missing auth 401, invalid token 401, inactive/non-admin 403, and active-admin success in src/features/admin/__tests__/admin-authorization.test.ts
- [x] T006 [P] Write schema tests for reason length, UUIDs, cursor pagination, page bounds, date ranges, enum filters, and idempotency headers in src/features/admin/__tests__/admin-schemas.test.ts
- [x] T007 [P] Write recursive response/audit/outbox redaction tests for credentials, tokens, raw device keys, provider payloads, raw audio, private full text, and payment fields in src/features/admin/__tests__/admin-redaction.test.ts
- [x] T008 Write migration static/integration tests for admin reason, append-only internal notes, RLS, indexes, and no payment artifacts in src/server/db/__tests__/admin-foundation-migration.test.ts
- [x] T009 Create additive migration for `audit_logs.admin_reason`, `admin_internal_notes`, append-only triggers, RLS, and admin query indexes in supabase/migrations/202606250015_admin_foundation.sql
- [x] T010 Implement active-admin loading and role enforcement in src/features/admin/admin.authorization.ts
- [x] T011 [P] Implement shared reason, pagination, cursor, date-range, UUID, filter, and command-envelope schemas in src/features/admin/admin.schemas.ts
- [x] T012 [P] Implement allowlist-first admin DTO redaction and prohibited-key defense in src/features/admin/admin-redaction.ts
- [x] T013 Implement admin error mapping, JSON parsing, idempotency-header parsing, cursor response shaping, and default dependency helpers in src/features/admin/admin-route-helpers.ts
- [x] T014 [P] Define `AdminQueryRepository` plus admin internal-note contracts and models in src/server/repositories/contracts/admin-query.repository.ts and src/server/repositories/contracts/admin-internal-note.repository.ts
- [x] T015 [P] Implement PostgreSQL admin internal-note repository and append-only queries in src/server/repositories/postgres/admin-internal-note.repository.ts
- [x] T016 [P] Implement in-memory admin internal-note repository for rollback/privacy tests in src/server/repositories/testing/in-memory-admin-internal-note.repository.ts
- [x] T017 Register admin note and query repository dependencies in src/server/repositories/contracts/unit-of-work.ts, src/server/repositories/postgres/postgres-unit-of-work.ts, and src/server/repositories/testing/in-memory-unit-of-work.ts
- [x] T018 Add foundation repository integration tests for note constraints, audit reason, rollback, and direct-access boundaries in src/server/repositories/postgres/__tests__/admin-foundation.integration.test.ts

---

## Phase 3: User Story 1 - Safely Manage Users and Administrator Access (Priority: P1) - Patch B

**Goal**: Admin can query users/devices/activity and safely mutate user status,
devices, and roles without losing the last active admin.

**Independent Test**: Search a user, suspend/reactivate, revoke a device, change
a non-final role, and race two last-admin mutations while preserving history,
redaction, audit, outbox, and at least one active admin.

### Tests

- [x] T019 [P] [US1] Write user-management service tests for list/detail/status/device/role/activity behavior, reason, replay, rollback, audit, outbox, and no hard delete in src/features/admin/__tests__/admin-user-management.service.test.ts
- [x] T020 [P] [US1] Write user admin route tests for the authorization matrix, filters, pagination, validation, and stable errors in src/features/admin/__tests__/admin-user.route-handlers.test.ts
- [x] T021 [P] [US1] Write repository contract tests for user cursors, device revocation, role mutations, active-admin count, and activity ordering in src/server/repositories/testing/__tests__/admin-user.repository.contract.test.ts
- [x] T022 [US1] Write PostgreSQL integration/concurrency tests for shared last-admin locking, simultaneous suspend/revoke/archive, idempotent replay, and rollback in src/server/repositories/postgres/__tests__/admin-user-management.integration.test.ts

### Implementation

- [x] T023 [US1] Extend user repository contracts with paginated admin queries, row locks, status updates, device lookup/revoke, role mutation, active-admin guard/count, and activity queries in src/server/repositories/contracts/user.repository.ts
- [x] T024 [P] [US1] Implement PostgreSQL user-management queries and the transaction advisory lock for last-admin protection in src/server/repositories/postgres/user.repository.ts
- [x] T025 [P] [US1] Implement equivalent in-memory user-management behavior and last-admin guard in src/server/repositories/testing/in-memory-user.repository.ts
- [x] T026 [US1] Implement `AdminUserManagementService` query methods and admin-safe DTO mappers in src/features/admin/admin-user-management.service.ts
- [x] T027 [US1] Implement user suspend/reactivate/archive commands with state re-check, idempotency, last-admin protection, audit reason, and outbox in src/features/admin/admin-user-management.service.ts
- [x] T028 [US1] Implement device revoke and role grant/revoke commands with locks, replay protection, audit, and outbox in src/features/admin/admin-user-management.service.ts
- [x] T029 [US1] Implement user activity timeline composition from audit, role, status, and device events in src/features/admin/admin-user-management.service.ts
- [x] T030 [US1] Implement user-management route-handler factory and stable response mapping in src/features/admin/admin-user.route-handlers.ts
- [x] T031 [P] [US1] Add user list/detail/status/activity App Router adapters under app/api/v1/admin/users/
- [x] T032 [P] [US1] Add user role grant/revoke App Router adapters under app/api/v1/admin/users/[userId]/roles/
- [x] T033 [P] [US1] Add user device list and device revoke App Router adapters in app/api/v1/admin/users/[userId]/devices/route.ts and app/api/v1/admin/devices/[deviceId]/revoke/route.ts
- [x] T034 [US1] Add route-contract coverage for all Patch B operation IDs and response status codes in src/features/admin/__tests__/admin-user.routes.contract.test.ts
- [x] T035 [US1] Run the Patch B focused unit, route, repository, and PostgreSQL tests documented in specs/003-careonroad-admin-operations/quickstart.md

---

## Phase 4: User Story 2 - Approve and Govern Mechanics (Priority: P1) - Patch C

**Goal**: Admin can govern mechanic eligibility and view trusted work metrics
without mutating ratings or orphaning active work.

**Independent Test**: Approve/reject pending mechanics, suspend/reactivate an
eligible mechanic, ban another, update skills/radius, force unavailable, and
verify active-assignment conflicts and immutable rating aggregates.

### Tests

- [x] T036 [P] [US2] Write mechanic-management service tests for all status commands, skill/radius updates, force unavailable, history/performance, reason, rollback, audit/outbox, and rating immutability in src/features/admin/__tests__/admin-mechanic-management.service.test.ts
- [x] T037 [P] [US2] Write mechanic admin route tests for authorization, filters, pagination, validation, and stable errors in src/features/admin/__tests__/admin-mechanic.route-handlers.test.ts
- [x] T038 [US2] Write migration and PostgreSQL integration tests for rejected status, active-assignment guards, atomic skill replacement, indexes, and no rating writes in src/server/repositories/postgres/__tests__/admin-mechanic-management.integration.test.ts

### Implementation

- [x] T039 [US2] Add rejected mechanic status and admin-list indexes in supabase/migrations/202606250016_admin_mechanic_management.sql
- [x] T040 [US2] Extend mechanic repository contracts for admin pagination, row-locked status changes, skill/radius replacement, forced unavailability, history, and performance in src/server/repositories/contracts/mechanic.repository.ts
- [x] T041 [P] [US2] Implement PostgreSQL admin mechanic queries and mutations without rating setters in src/server/repositories/postgres/mechanic.repository.ts
- [x] T042 [P] [US2] Implement in-memory admin mechanic queries, transitions, and active-assignment conflict behavior in src/server/repositories/testing/in-memory-mechanic.repository.ts
- [x] T043 [US2] Update mechanic profile status schemas and response mapping for rejected status without changing mechanic self-service write fields in src/features/motorcycles/mechanic-profile.service.ts
- [x] T044 [US2] Implement `AdminMechanicManagementService` list/detail/work-history/performance queries in src/features/admin/admin-mechanic-management.service.ts
- [x] T045 [US2] Implement approve/reject/suspend/ban/reactivate commands with state policy, assignment re-check, idempotency, audit reason, and outbox in src/features/admin/admin-mechanic-management.service.ts
- [x] T046 [US2] Implement skill/radius/force-unavailable commands with bounded schemas, locks, audit reason, and outbox in src/features/admin/admin-mechanic-management.service.ts
- [x] T047 [US2] Implement mechanic route-handler factory in src/features/admin/admin-mechanic.route-handlers.ts
- [x] T048 [P] [US2] Add mechanic list/detail/status command App Router adapters under app/api/v1/admin/mechanics/
- [x] T049 [P] [US2] Add mechanic skills/radius/unavailability/history/performance adapters under app/api/v1/admin/mechanics/[mechanicId]/
- [x] T050 [US2] Run Patch C focused tests and verify existing mechanic profile/location/availability contracts in specs/003-careonroad-admin-operations/quickstart.md

---

## Phase 5: User Story 3 - Recover Service Requests and Dispatch Operations (Priority: P1)

**Goal**: Admin can inspect and recover requests and dispatch through explicit,
state-safe commands.

**Independent Test**: Cancel/escalate a request, add a private note, expire an
overdue round, explain every failure category, retry valid dispatch, manually
assign one eligible mechanic, and reject all stale/conflicting cases atomically.

### Patch D - Admin Service-Request Operations

#### Tests

- [x] T051 [P] [US3] Write request-management service tests for list/detail/timeline/cancel/escalate/notes/media/assignment/quotes, rollback, dispatch reconciliation, audit/outbox, and private-text redaction in src/features/admin/__tests__/admin-service-request.service.test.ts
- [x] T052 [P] [US3] Write request admin route tests for authorization, reason, idempotency, filters, pagination, metadata-only media, and absence of arbitrary status input in src/features/admin/__tests__/admin-service-request.route-handlers.test.ts
- [x] T053 [US3] Write PostgreSQL integration tests for request locks, cancel/escalate races, open-offer reconciliation, note privacy, and transaction rollback in src/server/repositories/postgres/__tests__/admin-service-request.integration.test.ts

#### Implementation

- [x] T054 [US3] Extend `AdminQueryRepository` and related service-request, media, assignment, quote, dispatch, and audit contracts with bounded request views and row-lock operations in src/server/repositories/contracts/admin-query.repository.ts and src/server/repositories/contracts/service-request.repository.ts
- [x] T055 [P] [US3] Implement PostgreSQL paginated request detail/timeline/relationship queries in src/server/repositories/postgres/admin-query.repository.ts
- [x] T056 [P] [US3] Implement equivalent in-memory request query models in src/server/repositories/testing/in-memory-admin-query.repository.ts
- [x] T057 [US3] Implement explicit admin request cancel/escalation transition policy and dispatch reconciliation helpers in src/features/admin/admin-request-state.ts
- [x] T058 [US3] Implement `AdminServiceRequestService` read methods and metadata-first DTOs in src/features/admin/admin-service-request.service.ts
- [x] T059 [US3] Implement cancel/manual-escalate commands with request/round/candidate locks, idempotency, history, audit reason, and outbox in src/features/admin/admin-service-request.service.ts
- [x] T060 [US3] Implement request internal-note creation with note-text isolation in src/features/admin/admin-service-request.service.ts
- [x] T061 [US3] Implement service-request route-handler factory in src/features/admin/admin-service-request.route-handlers.ts
- [x] T062 [P] [US3] Add request list/detail/timeline/cancel/escalate/note App Router adapters under app/api/v1/admin/service-requests/
- [x] T063 [P] [US3] Add request media/assignment/quote read adapters under app/api/v1/admin/service-requests/[requestId]/
- [x] T064 [US3] Run Patch D focused tests and verify rider-owned service-request routes expose no admin notes in specs/003-careonroad-admin-operations/quickstart.md

### Patch E - Admin Dispatch Operations

Batches 09–11 complete Patch E locally. Dispatch policy/reads/expire/retry/cancel reuse `DispatchService`; manual creation shares `AdminAssignmentService` with Patch F. Tests are `admin-dispatch.test.ts`, `admin-assignment.test.ts`, native `dispatch.repository.integration.test.ts`, and migration `admin-recovery-migrations.test.ts`. Migration 038 stores capped search episodes; 039 stores assignment provenance. No separate service/policy wrapper was added. Batch 14 adds local HTTP/JWT acceptance; real providers and production rollout remain pending.

#### Tests

- [x] T065 [P] [US3] Write dispatch service tests for status/round/detail/expiry/retry/cancel/eligibility/manual assignment and every seeded failure combination, asserting all applicable failure reason categories, safe counts where meaningful, only next-command categories valid for the request state, and no private location history or secrets in src/features/admin/__tests__/admin-dispatch.test.ts and src/features/admin/__tests__/admin-assignment.test.ts
- [x] T066 [P] [US3] Write dispatch route tests for authorization, reason, idempotency, pagination, stale-state conflicts, and stable errors in src/features/admin/__tests__/admin-dispatch.test.ts
- [x] T067 [P] [US3] Write migration static tests for assignment-source constraints, nullable candidate policy, admin provenance, supersedes uniqueness, and no payment schema in src/server/db/__tests__/admin-recovery-migrations.test.ts
- [x] T068 [US3] Write PostgreSQL concurrency tests for expiry-versus-accept, retry-versus-active-round, two manual assignments, active-job conflict, and rollback in src/server/repositories/postgres/__tests__/dispatch.repository.integration.test.ts

#### Implementation

- [x] T069 [US3] Add assignment source/provenance/supersedes fields and source-dependent constraints in supabase/migrations/202606250039_admin_assignment_provenance.sql
- [x] T070 [US3] Update assignment contracts and candidate identity semantics for offer/manual/reassignment sources in src/server/repositories/contracts/assignment.repository.ts
- [x] T071 [P] [US3] Implement PostgreSQL assignment provenance mapping and manual-create locks in src/server/repositories/postgres/assignment.repository.ts
- [x] T072 [P] [US3] Implement in-memory assignment provenance and manual-create behavior in src/server/repositories/testing/in-memory-assignment.repository.ts
- [x] T073 [US3] Extend dispatch repository contracts with round locks, overdue expiry, categorized eligibility, and valid-offer queries in src/server/repositories/contracts/dispatch.repository.ts
- [x] T074 [P] [US3] Implement PostGIS admin eligibility and dispatch-failure reason aggregation in src/server/repositories/postgres/dispatch.repository.ts
- [x] T075 [P] [US3] Implement deterministic in-memory eligibility/failure explanations in src/server/repositories/testing/in-memory-dispatch.repository.ts
- [x] T076 [US3] Implement admin dispatch state policy for overdue expiry, retry limits, cancellation, and manual-assignable request states in src/features/admin/admin-assignment.service.ts and src/features/dispatch/dispatch.service.ts
- [x] T077 [US3] Implement `DispatchService` read and eligibility methods plus failure explanations containing all applicable categories, safe counts where meaningful, and allowlisted next-command categories derived from the request's current state in src/features/dispatch/dispatch.service.ts
- [x] T078 [US3] Implement expire/retry/cancel commands with round/candidate/request locks, idempotency, history, audit reason, and outbox in src/features/dispatch/dispatch.service.ts
- [x] T079 [US3] Implement manual assignment with request/mechanic/assignment/dispatch locks and all eligibility invariants in src/features/admin/admin-assignment.service.ts and src/features/dispatch/dispatch.service.ts
- [x] T080 [US3] Implement dispatch route-handler factory in src/features/admin/admin-dispatch.route-handlers.ts
- [x] T081 [P] [US3] Add dispatch status/round/expiry App Router adapters under app/api/v1/admin/dispatch/ and app/api/v1/admin/service-requests/[requestId]/dispatch/
- [x] T082 [P] [US3] Add dispatch retry/cancel/manual-assign/eligible/explanation adapters under app/api/v1/admin/service-requests/[requestId]/dispatch/
- [x] T083 [US3] Run Patch E focused and concurrency tests and verify normal mechanic offer acceptance remains unchanged in specs/003-careonroad-admin-operations/quickstart.md

---

## Phase 6: User Story 4 - Resolve Assignment, Diagnosis, and Quote Cases (Priority: P2)

**Goal**: Admin can resolve assignment and quote exceptions while preserving
history and immutable content.

**Independent Test**: Cancel/reassign a pre-diagnosis job, reject unsupported
stuck actions, request revisions, void/expire eligible pending quotes, and race a
rider decision without overwriting domain records.

### Patch F - Admin Assignment Operations

#### Tests

- [x] T084 [P] [US4] Write assignment operations service tests for detail/timeline/cancel/reassign/stuck actions/notes, state policy, rollback, history, audit/outbox, and no force-status in src/features/admin/__tests__/admin-assignment.test.ts
- [x] T085 [P] [US4] Write assignment route tests for authorization, reason, idempotency, validation, and stable conflicts in src/features/admin/__tests__/admin-assignment.test.ts
- [x] T086 [US4] Write PostgreSQL concurrency tests for simultaneous reassignments, mechanic active-job conflicts, request synchronization, supersedes uniqueness, and rollback in src/server/repositories/postgres/__tests__/dispatch.repository.integration.test.ts

#### Implementation

- [x] T087 [US4] Implement explicit admin assignment cancel/reassign/stuck action policy in src/features/admin/admin-assignment.service.ts and src/features/assignments/assignment-cancellation.ts
- [x] T088 [US4] Extend assignment repository history/detail locks and replacement queries in src/server/repositories/contracts/assignment.repository.ts
- [x] T089 [P] [US4] Implement PostgreSQL cancel/replacement/history operations in src/server/repositories/postgres/assignment.repository.ts
- [x] T090 [P] [US4] Implement in-memory cancel/replacement/history operations in src/server/repositories/testing/in-memory-assignment.repository.ts
- [x] T091 [US4] Implement `AdminAssignmentService` detail/timeline and canonical cancellation in src/features/admin/admin-assignment.service.ts
- [x] T092 [US4] Implement canonical reassignment transaction using shared dispatch eligibility/closure in src/features/admin/admin-assignment.service.ts
- [x] T093 [US4] Implement allowlisted stuck resolution and assignment internal-note commands in src/features/admin/admin-assignment.service.ts
- [x] T094 [US4] Implement assignment route-handler factory in src/features/admin/admin-assignment.route-handlers.ts
- [x] T095 [P] [US4] Add assignment detail/timeline/cancel/reassign adapters under app/api/v1/admin/assignments/[assignmentId]/
- [x] T096 [P] [US4] Add assignment resolve-stuck and internal-note adapters under app/api/v1/admin/assignments/[assignmentId]/
- [x] T097 [US4] Run Patch F state-machine/concurrency tests and verify existing mechanic/admin assignment transition routes in specs/003-careonroad-admin-operations/quickstart.md

### Patch G - Admin Diagnosis and Quote Supervision

#### Tests

- [x] T098 [P] [US4] Write diagnosis/quote supervision service tests for redacted detail, history, revision, void, expiry, dispute commands, immutability, reason, audit/outbox, and new-version requirements in src/features/admin/__tests__/admin-supervision.test.ts
- [x] T099 [P] [US4] Write diagnosis/quote admin route tests for authorization, idempotency, allowlisted resolutions, stable conflicts, and text redaction in src/features/admin/__tests__/admin-supervision.test.ts
- [x] T100 [US4] Write ordered-migration and PostgreSQL race tests proving quote enum migration 040 commits before supervision migration 041 uses `voided`, plus rider approval versus void/expiry and unchanged diagnosis/quote content in src/server/repositories/postgres/__tests__/diagnosis-quote.repositories.integration.test.ts

#### Implementation

- [x] T101 [US4] Add `voided` enum-only migration followed by append-only supervision actions, transition constraints, indexes, and RLS in supabase/migrations/202606250040_admin_quote_status.sql and supabase/migrations/202606250041_admin_supervision_actions.sql
- [x] T102 [P] [US4] Define admin supervision repository contract and action models in src/server/repositories/contracts/admin-supervision.repository.ts
- [x] T103 [P] [US4] Implement PostgreSQL supervision action repository and quote row locks in src/server/repositories/postgres/admin-supervision.repository.ts
- [x] T104 [P] [US4] Implement in-memory supervision action repository in src/server/repositories/testing/in-memory-admin-supervision.repository.ts
- [x] T105 [US4] Extend quote status contracts/repositories for pending-to-voided transition without content mutation in src/server/repositories/contracts/quote.repository.ts and src/server/repositories/postgres/quote.repository.ts
- [x] T106 [US4] Register supervision repositories in all UnitOfWork implementations in src/server/repositories/contracts/unit-of-work.ts
- [x] T107 [US4] Implement `AdminSupervisionService` redacted reads and revision request commands in src/features/admin/admin-supervision.service.ts
- [x] T108 [US4] Implement quote void/expiry/dispute commands with related-row locks, latest-state checks, audit reason, and outbox in src/features/admin/admin-supervision.service.ts
- [x] T109 [US4] Implement diagnosis/quote route-handler factory in src/features/admin/admin-supervision.route-handlers.ts
- [x] T110 [P] [US4] Add diagnosis revision and quote history/revision/void/expire/dispute adapters under app/api/v1/admin/diagnoses/, app/api/v1/admin/quotes/, and app/api/v1/admin/service-requests/
- [x] T111 [US4] Run Patch G race/immutability tests and scan audit/outbox fixtures for full diagnosis or quote narrative in specs/003-careonroad-admin-operations/quickstart.md

---

## Phase 7: User Story 5 - Operate Audit, Notification, and Outbox Recovery (Priority: P2) - Patch H1

**Goal**: Admin can query immutable audit and safely recover or terminate
notification/outbox delivery without leaking payloads or repeating domain work.

**Independent Test**: Query/export sanitized audit, retry/cancel notifications,
retry/abandon eligible outbox events, reject leased/processed cases, and prove no
duplicate domain mutation.

### Tests

- [x] T112 [P] [US5] Write audit query/export service tests for filters, cursors, entity/actor/admin timelines, export bounds, source audit rows not being modified/deleted/reordered/replaced, each successful export appending exactly one sanitized export-access audit record, and exported content never being copied into that record in src/features/admin/__tests__/admin-delivery-audit.test.ts
- [x] T113 [P] [US5] Write notification operations service tests for list/detail/summary/retry/cancel, delivery races, reason, idempotency, audit/outbox, and no manual sent in src/features/admin/__tests__/admin-delivery-audit.test.ts
- [x] T114 [P] [US5] Write outbox operations service tests for list/detail/dead-letter/health/retry/abandon, lease conflicts, redaction, idempotency, and no duplicate domain mutation in src/features/admin/__tests__/admin-delivery-audit.test.ts
- [x] T115 [P] [US5] Write Patch H1 route tests for the admin authorization matrix, filters, pagination, reason validation, export bounds, and stable errors in src/features/admin/__tests__/admin-delivery-audit.test.ts
- [x] T116 [US5] Write ordered-migration and PostgreSQL concurrency tests proving enum migration 042 commits before delivery migration 043 uses canceled/abandoned, plus claim exclusions, retry reset, active leases, and append-only audit in src/server/repositories/postgres/__tests__/admin-delivery-audit.integration.test.ts and src/server/db/__tests__/migration-lifecycle.integration.test.ts

### Implementation

- [x] T117 [US5] Add canceled/abandoned enum-only migration followed by delivery provenance fields, constraints, and claim indexes in supabase/migrations/202606250042_admin_delivery_statuses.sql and supabase/migrations/202606250043_admin_delivery_operations.sql
- [x] T118 [US5] Extend audit repository contract with paginated safe queries, admin reason, timelines, and bounded export in src/server/repositories/contracts/audit.repository.ts
- [x] T119 [P] [US5] Implement PostgreSQL audit filters/cursors/export and admin action history in src/server/repositories/postgres/audit.repository.ts
- [x] T120 [P] [US5] Implement equivalent in-memory audit queries in src/server/repositories/testing/in-memory-audit.repository.ts
- [x] T121 [US5] Extend notification repository contracts and adapters for row locks, failed retry, pending cancel, and summaries in src/server/repositories/contracts/notification.repository.ts
- [x] T122 [US5] Extend outbox repository contracts and adapters for safe queries, row locks, dead-letter retry, abandon, and health in src/server/repositories/contracts/outbox.repository.ts
- [x] T123 [US5] Update outbox worker claim/delivery handling to exclude abandoned/canceled work without changing normal retry behavior in src/features/outbox/outbox-consumers.ts, src/features/notifications/notification-delivery.service.ts, and PostgreSQL receipt/outbox adapters
- [x] T124 [US5] Implement `AdminAuditService` with source-row-preserving queries and a sanitized bounded export command that appends exactly one access-audit event containing only requesting admin, filter hash, exported count, and timestamp without exported content in src/features/admin/admin-audit.service.ts
- [x] T125 [US5] Implement `AdminDeliveryService` queries and retry/cancel commands in src/features/admin/admin-delivery.service.ts
- [x] T126 [US5] Implement `AdminDeliveryService` queries and retry/abandon commands in src/features/admin/admin-delivery.service.ts
- [x] T127 [P] [US5] Implement audit, notification, and outbox route-handler factories in src/features/admin/admin-audit.route-handlers.ts, src/features/admin/admin-delivery.route-handlers.ts
- [x] T128 [P] [US5] Add audit query/export/admin-action adapters under app/api/v1/admin/audit/
- [x] T129 [P] [US5] Add notification list/detail/retry/cancel/summary adapters under app/api/v1/admin/notifications/
- [x] T130 [P] [US5] Add outbox list/detail/dead-letter/retry/abandon/health adapters under app/api/v1/admin/outbox/
- [x] T131 [US5] Add static redaction regression tests for all Patch H1 list/detail/export DTOs in src/features/admin/__tests__/admin-delivery-audit.test.ts
- [x] T132 [US5] Run Patch H1 focused/worker tests and verify no external delivery provider or direct source-audit mutation route was added in specs/003-careonroad-admin-operations/quickstart.md

---

## Phase 8: User Story 6 - Recover Reminder Processing (Priority: P3) - Patch H2

**Goal**: Admin can inspect, enable/disable, and safely retry failed time-based
reminders without duplicate notifications or odometer behavior.

**Independent Test**: Disable/enable a rule, retry one failed occurrence twice,
race worker processing, and reject sent/dismissed retries.

### Tests

- [x] T133 [P] [US6] Write reminder admin service tests for list/detail/occurrences/health/enable/disable/retry, state rules, idempotency, audit/outbox, and no duplicate spam in src/features/admin/__tests__/admin-reminder-dashboard.test.ts
- [x] T134 [P] [US6] Write reminder admin route tests for authorization, filters, pagination, reason, next-due validation, and stable errors in src/features/admin/__tests__/admin-reminder-dashboard.test.ts
- [x] T135 [US6] Write PostgreSQL concurrency tests for admin retry versus worker claim, sent/dismissed rejection, failure-count handling, and rollback in src/server/repositories/postgres/__tests__/admin-reminder-dashboard.integration.test.ts

### Implementation

- [x] T136 [US6] Extend reminder repository contracts with admin pagination, rule/occurrence locks, enable/disable, failed retry, and health queries in src/server/repositories/contracts/reminder.repository.ts
- [x] T137 [P] [US6] Implement PostgreSQL admin reminder queries and contested retry behavior in src/server/repositories/postgres/reminder.repository.ts
- [x] T138 [P] [US6] Implement in-memory admin reminder queries and retry behavior in src/server/repositories/testing/in-memory-reminder.repository.ts
- [x] T139 [US6] Implement `AdminReminderService` read methods and enable/disable/retry commands in src/features/admin/admin-reminder.service.ts
- [x] T140 [US6] Implement reminder route-handler factory in src/features/admin/admin-reminder.route-handlers.ts
- [x] T141 [P] [US6] Add reminder list/detail/enable/disable/occurrence adapters under app/api/v1/admin/reminders/
- [x] T142 [P] [US6] Add failed-occurrence retry and reminder worker-health adapters under app/api/v1/admin/reminder-occurrences/ and app/api/v1/admin/reminders/worker-health/
- [x] T143 [US6] Run Patch H2 focused/worker tests and static-check that no kilometer/odometer fields exist in src/features/admin/__tests__/admin-api-routes.static.test.ts

---

## Phase 9: User Story 7 - Monitor Operational Health (Priority: P3) - Patch I

**Goal**: Admin can read reconciled operational metrics and all nine implemented
stuck-workflow categories without mutating state.

**Independent Test**: Seed known aggregates and one fixture per stuck category;
verify exact totals, one finding per target/category, safe next actions, read-only
behavior, and bounded runtime.

### Tests

- [x] T144 [P] [US7] Write dashboard service tests for all metric groups, date bounds, reconciliation, and read-only behavior in src/features/admin/__tests__/admin-reminder-dashboard.test.ts
- [x] T145 [P] [US7] Write stuck-workflow tests for nine categories, threshold boundaries, no duplicates, reason codes, and safe next actions in src/features/admin/__tests__/admin-reminder-dashboard.test.ts and src/server/repositories/postgres/__tests__/admin-reminder-dashboard.integration.test.ts
- [x] T146 [P] [US7] Write dashboard route tests for authorization, filters, pagination, response bounds, and stable errors in src/features/admin/__tests__/admin-reminder-dashboard.test.ts
- [x] T147 [US7] Write PostgreSQL aggregate reconciliation, threshold-boundary, duplicate-finding, and response-bound tests in src/server/repositories/postgres/__tests__/admin-reminder-dashboard.integration.test.ts

### Implementation

- [x] T148 [US7] Extend `AdminQueryRepository` with bounded operational summary, dispatch, assignment, mechanic, request, worker, and stuck-workflow queries in src/server/repositories/contracts/admin-query.repository.ts
- [x] T149 [P] [US7] Implement PostgreSQL aggregate and nine-category stuck-workflow queries without dashboard persistence in src/server/repositories/postgres/admin-query.repository.ts
- [x] T150 [P] [US7] Implement deterministic in-memory dashboard aggregates and findings in src/server/repositories/testing/in-memory-admin-query.repository.ts
- [x] T151 [US7] Define documented default assignment/reminder stuck thresholds and safe action mappings in src/features/admin/admin-operational-policy.ts
- [x] T152 [US7] Implement `AdminDashboardService` read-only DTO composition in src/features/admin/admin-dashboard.service.ts
- [x] T153 [US7] Implement dashboard route-handler factory in src/features/admin/admin-dashboard.route-handlers.ts
- [x] T154 [P] [US7] Add summary/metrics/workers/stuck-workflows adapters under app/api/v1/admin/dashboard/

---

## Phase 10: User Story 8 - Manage Optional Operational Configuration (Priority: P4) - Patch J

**Goal**: Optionally allow only four bounded, versioned, non-secret dispatch
settings and read-only provider budget metadata; deferring this phase does not
block Patches A-I.

**Independent Test**: When Patch J is explicitly authorized, update each of the
four allowlisted dispatch keys at valid boundaries, verify version/audit/outbox,
read provider budget metadata, and reject unknown, feature-flag,
provider-budget, maintenance-mode, secret-like, and out-of-range mutations.

### Tests

- [x] T155 [P] [US8] Write configuration service tests for the exact four-key dispatch allowlist, defaults, types, numeric bounds, ascending 1-to-8 radius steps, total-wait-versus-offer-expiry validation, versions, Patch-J-disabled behavior, read-only provider budget metadata, rejected feature-flag/provider-budget/maintenance mutations, reason, idempotency, audit/outbox, rollback, and secret rejection in src/features/admin/__tests__/admin-configuration.test.ts
- [x] T156 [P] [US8] Write configuration route tests for authorization, reason, exact dispatch keys, boundary values, provider-budget read-only access, unknown/feature-flag/provider-budget/maintenance/secret-like mutation rejection, and stable errors in src/features/admin/__tests__/admin-configuration.test.ts
- [x] T157 [US8] Write migration and PostgreSQL integration tests for current/version rows restricted to the four dispatch keys, atomic increments, append-only history, RLS, and no credential, feature-flag, provider-budget, or maintenance-mode storage in src/server/repositories/postgres/__tests__/admin-configuration.integration.test.ts

### Implementation

- [x] T158 [US8] Add optional configuration current/version tables restricted to `dispatch.radius_steps_km`, `dispatch.offer_expiry_seconds`, `dispatch.max_rounds`, and `dispatch.total_wait_seconds`, with constraints, indexes, append-only history, and RLS in supabase/migrations/202606250045_admin_dispatch_configuration.sql (explicitly authorized Batch 15)
- Batch 15 follow-up: migration `202606250046_dispatch_radius_policy_bounds.sql` accepts configured radii within 1–100 km. Native dispatch/worker tests exercise non-default fractional steps and snapshot preservation across configuration updates.
- [x] T159 [P] [US8] Define the four typed mutable dispatch values and read-only provider budget metadata in the admin configuration repository contract in src/server/repositories/contracts/admin-configuration.repository.ts
- [x] T160 [P] [US8] Implement PostgreSQL locking, exact-key validation, versioning, and reads for the four dispatch configuration keys in src/server/repositories/postgres/admin-configuration.repository.ts
- [x] T161 [P] [US8] Implement equivalent in-memory four-key dispatch configuration behavior in src/server/repositories/testing/in-memory-admin-configuration.repository.ts
- [x] T162 [US8] Register optional configuration repositories in all UnitOfWork implementations in src/server/repositories/contracts/unit-of-work.ts
- [x] T163 [US8] Implement exact four-key dispatch schemas with documented defaults, types, bounds, ascending radius steps, cross-field total-wait validation, and unknown/secret/feature-flag/provider-budget/maintenance mutation rejection in src/features/admin/admin-configuration.schemas.ts
- [x] T164 [US8] Implement `AdminConfigurationService` dispatch reads/updates and read-only provider budget metadata without feature-flag, provider-budget, maintenance-mode, or chatbot/provider behavior mutations in src/features/admin/admin-configuration.service.ts
- [x] T165 [US8] Implement configuration route-handler factory in src/features/admin/admin-configuration.route-handlers.ts
- [x] T166 [P] [US8] Add configuration read, dispatch update, and read-only provider-budget metadata adapters under app/api/v1/admin/configuration/

---

## Phase 11: Polish and Cross-Cutting Verification

**Purpose**: Verify all selected patches as one backend feature.

- [x] T167 [P] Add full admin API operation-to-route contract coverage in src/features/admin/__tests__/admin-api-routes.static.test.ts
- [x] T168 [P] Add cross-module mutation audit/outbox/idempotency matrix tests in the existing admin-assignment, admin-supervision, admin-delivery-audit, admin-reminder-dashboard and admin-configuration tests plus their native SQL suites
- [x] T169 [P] Add sensitive-field scans for admin responses, logs, audit, outbox, fixtures, and exports in admin redaction/delivery/reminder/configuration regressions, server-logger tests and HTTP response/server-log secret scans
- [x] T170 Add mandatory migrations 015–046 ordering, enum-commit boundaries, constraints, RLS, retention-index, no-payment assertions, and conditional optional Patch J migration assertions restricting storage to the four dispatch keys when Patch J is included in src/server/db/__tests__/all-migrations.static.test.ts
- [x] T171 Run local scenarios and scope guards in specs/003-careonroad-admin-operations/quickstart.md; real provider/device/production acceptance remains a separate release gate
- [x] T172 Run `pnpm.cmd test`, `pnpm.cmd run test:db`, `pnpm.cmd run test:http`, `pnpm.cmd run typecheck`, and `pnpm.cmd run lint` from package.json
- [x] T173 Run `pnpm.cmd run build` and verify no admin frontend bundle or route was created outside app/api/v1/admin/
- [x] T174 Update CAREONROAD_CODEBASE_HANDBOOK.md and AGENTS.md only for implemented feature behavior and final migration status
- [x] T175 Add PostgreSQL-backed performance acceptance tests for every bounded admin list/detail operation, including five warm-up requests, 20 measured requests per operation, 19-of-20 <= 2 seconds, and response-bound assertions in src/server/testing/__tests__/http-acceptance.integration.test.ts

---

## Dependencies and Execution Order

### Patch Dependencies

```text
Patch A
  |-- Patch B (users)
  |-- Patch C (mechanics)
  |-- Patch D (requests)
  |     `-- Patch E (dispatch/manual assignment)
  |            `-- Patch F (assignment reassignment)
  |                   `-- Patch G (diagnosis/quote supervision)
  |-- Patch H1 (audit/notification/outbox)
  |-- Patch H2 (reminders)
  `-- Patch I (dashboard; complete after B-H for full metrics)

Patch J is optional and depends on Patch A; it should follow Patch I.
```

### User Story Dependencies

- **US1** depends only on Patch A.
- **US2** depends only on Patch A, but its active-assignment conflict uses
  existing assignment data.
- **US3** depends on Patch A; Patch E depends on Patch D and migration 039.
- **US4** depends on Patch E provenance; Patch G depends on Patch F behavior.
- **US5** depends on Patch A and ordered migrations 042-043; it can begin after Patch A if
  domain patches do not concurrently edit the same repository contracts.
- **US6** depends on Patch A; it can proceed independently of US5 after shared
  Patch H migration coordination.
- **US7** is read-only but should be completed after B-H so every required
  category and metric is represented.
- **US8** is optional and depends only on Patch A; schedule it last to keep
  operational scope reviewable.

### Parallel Opportunities

- T003-T004 and T005-T007 can run in parallel.
- PostgreSQL and in-memory repository adapters marked `[P]` can be developed in
  parallel after their contracts/migrations.
- Route adapters for disjoint resource trees can run in parallel after the
  route-handler factory exists.
- Patches B, C, H1, and H2 can proceed in parallel after Patch A when developers
  avoid shared UnitOfWork merge conflicts.
- Dashboard query/test work can be parallelized by metric group before final
  service composition.

## Parallel Examples

### Patch B / US1

```text
T019 service tests
T020 route tests
T021 repository contract tests

Then in parallel:
T024 PostgreSQL user repository
T025 in-memory user repository
```

### Patch E / US3

```text
T065 service tests
T066 route tests
T067 migration static tests

After contracts:
T071 PostgreSQL assignment provenance
T072 in-memory assignment provenance
T074 PostgreSQL dispatch explanation
T075 in-memory dispatch explanation
```

### Patch H / US5-US6

```text
T112 audit tests
T113 notification tests
T114 outbox tests
T133 reminder tests

After shared migration coordination:
T127 audit/notification/outbox handlers
T137 PostgreSQL reminder repository
T138 in-memory reminder repository
```

## Implementation Strategy

### Recommended MVP

1. Complete Patch A.
2. Complete Patch B (US1) and validate last-admin protection.
3. Complete Patch C (US2).
4. Complete Patches D-E (US3) to resolve current dispatch expiry gaps.
5. Stop and run all P1 acceptance/concurrency/regression tests.

This P1 slice gives the operator safe user/mechanic governance and dispatch
recovery without waiting for dashboard or optional configuration.

### Incremental Delivery

1. A-B: safe admin foundation and user lifecycle.
2. C: mechanic eligibility governance.
3. D-E: request and dispatch recovery.
4. F-G: assignment and quote exception handling.
5. H1-H2: async operations, audit, and reminder recovery.
6. I: operational visibility.
7. J: optional runtime configuration.
8. Final cross-cutting verification after every selected patch.

## Notes

- Tests for each patch are written before or with implementation and must fail
  for the missing behavior before production code is added.
- `[P]` means different files and no dependency on another incomplete task in
  the same phase.
- Every task names its target file or directory.
- Patch J and its new migration are skipped unless explicitly authorized.
- No task authorizes payment, frontend, inventory, odometer, tracking, Maps, or
  chatbot/ASR implementation.
