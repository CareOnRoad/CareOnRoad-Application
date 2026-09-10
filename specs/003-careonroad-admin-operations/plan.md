# Implementation Plan: CareOnRoad Admin Operations

**Branch**: `003-careonroad-admin-operations` | **Date**: 2026-07-05 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from
`/specs/003-careonroad-admin-operations/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a backend-only administrative operations layer to the existing CareOnRoad
modular monolith. The layer exposes authenticated `/api/v1/admin` route
adapters, feature-owned services, transaction-scoped repositories, additive
PostgreSQL migrations, sanitized audit/outbox records, bounded admin-safe read
models, and explicit command endpoints for exceptional operations.

The implementation is split into reviewable Patches A-J. It reuses existing
domain state machines and assignment invariants, adds dedicated admin command
policies where existing rider/mechanic transitions cannot express a safe
operational recovery, and never exposes a generic status setter. Read-only
timelines and dashboards derive from existing records wherever possible.

Payment is implemented separately in feature 005 and remains outside this admin
operations scope. Existing chatbot, ASR, provider order, retrieval, safety gate,
fallback, post-validation, rate limits, logger, route contracts, and frontend
remain unchanged.

## Technical Context

**Language/Version**: TypeScript 5.6+ on Node.js through Next.js App Router

**Primary Dependencies**:

- Existing Next.js 15 App Router route adapters and React 19 application.
- Existing Zod 3 schemas, `postgres` transaction client, `jose` JWT
  verification, and Vitest 2 test infrastructure.
- Existing Supabase/PostgreSQL migrations, PostGIS eligibility queries, audit,
  outbox, notification, reminder, and assignment foundations.
- No new runtime dependency is planned.

**Storage**: Existing Supabase-managed PostgreSQL with PostGIS. Eight additive
admin migrations are proposed after `202606250014_indexes_constraints_rls.sql`.
This feature does not add payment tables, providers, routes, or repositories.

**Testing**:

- Vitest service and route tests with in-memory repositories and fake JWT
  identities.
- Repository contract and PostgreSQL integration tests against disposable test
  schemas when `TEST_DATABASE_URL` is available.
- Transaction rollback, concurrent last-admin, dispatch expiry/accept race,
  manual assignment/reassignment, retry deduplication, audit/outbox, redaction,
  pagination, and migration tests.
- Existing chatbot, ASR, rider, mechanic, worker, build, lint, and typecheck
  suites remain regression gates.

**Target Platform**: Existing Next.js Node.js server runtime and protected
backend worker routes. No browser-admin or mobile-admin client is included.

**Project Type**: Existing full-stack web application receiving a backend-only
administrative API surface.

**Performance Goals**:

- After five warm-up requests, every bounded admin list and detail operation is
  executed 20 times against the agreed MVP operational dataset. At least 19 of
  20 requests per operation complete within two seconds.
- Pagination never returns more than 100 records; audit export never returns
  more than 10,000 records.
- Dispatch explanation is evaluated against 50 deterministic mechanic fixtures
  and follows the same five-warm-up, 20-request, 19-of-20 within two-seconds
  acceptance target.
- Concurrent last-admin and assignment tests complete five contested pairs
  within 30 seconds with no invariant violation or lock residue.
- The agreed MVP operational dataset contains at least:
  - 100 users;
  - 50 mechanics;
  - 100 service requests;
  - 50 assignments;
  - 500 audit logs;
  - 100 notifications/outbox events;
  - 100 reminders/occurrences;
  - internal notes and configuration rows only when their patches are included.
- These are bounded acceptance targets for the MVP dataset, not production
  capacity claims.

**Constraints**:

- Backend-only; all new routes live below `/api/v1/admin`.
- Every route authenticates a current active app actor and requires role
  `admin`.
- Every mutation requires `reason` and `X-Idempotency-Key`.
- State-changing commands use a transaction, lock/re-check current state, append
  sanitized audit with a dedicated admin reason, and append an outbox event when
  operationally meaningful.
- No hard delete, arbitrary status setter, direct rating update, direct audit
  mutation, or constraint bypass.
- Admin list/dashboard/timeline DTOs are metadata-first and omit credentials,
  raw device keys, raw provider payloads, raw audio, chatbot/rider full text,
  payment-sensitive data, and unrestricted private narrative fields.
- Full diagnosis, recommended-work, safety-note, internal-note, rider-problem,
  and chatbot text is never returned by this feature or copied into logs, audit,
  outbox, dashboard, timeline, or export responses.
- Existing non-admin API behavior and response contracts do not change.
- Existing notification delivery remains a persistence/worker baseline; this
  feature does not add a real external delivery provider.
- Configuration Patch J is optional and unavailable unless explicitly
  authorized and its migration is applied.

**Scale/Scope**:

- Pilot operations for one city/region.
- Tens of thousands of users, motorcycles, reminders, notifications, and audit
  events.
- Hundreds of concurrent active service requests and moderate administrator
  concurrency.
- One admin role only; no support/dispatcher/finance sub-roles in this feature.

## Constitution Check

*GATE: Passed before research and re-checked after Phase 1 design.*

- Advisory AI output: **PASS**. No AI output or chatbot behavior is changed and
  no admin command is initiated by AI.
- Backend-controlled AI safety: **PASS**. Safety gate, retrieval, Gemini then
  OpenRouter order, schema validation, post-validation, fallback, rate limit,
  local ASR, and privacy-safe logging remain unchanged.
- Secret isolation: **PASS**. Admin schemas and DTOs are allowlisted and redacted;
  no credential or provider secret is added to configuration or responses.
- Vietnamese-first chatbot: **PASS**. Chatbot input/output is untouched.
- Dangerous overrides: **PASS**. Existing overrides and their tests remain
  mandatory regression gates.
- Validated JSON and fallback: **PASS**. Existing provider validation and local
  fallback remain unchanged.
- Backend workflow scope: **PASS**. Work is limited to authenticated backend
  administration, repositories, migrations, audit, outbox, and operational read
  models.
- Excluded scope: **PASS**. No frontend, payment Patch 6, settlement, refunds,
  inventory, odometer reminder, tracking, Maps, or chatbot/ASR rewrite.
- Workflow integrity: **PASS**. The plan uses explicit commands, existing state
  rules, row locks, transaction re-checks, database constraints, idempotency,
  append-only audit, and outbox dedupe.
- Required tests: **PASS BY DESIGN**. Authorization, last-admin concurrency,
  state transitions, rollback, idempotency, migration, redaction, audit/outbox,
  worker recovery, and chatbot regression are explicit.

**Pre-design gate result**: PASS.

**Post-design gate result**: PASS. The data model adds only operational records
and provenance required by explicit admin commands; no constitution exception
or complexity waiver is required.

## Architecture Decisions

### Route and service boundary

- New route files are thin adapters under `app/api/v1/admin/**`.
- Domain behavior lives in `src/features/admin/**`.
- `admin.route-handlers.ts` provides dependency-injected and default factories,
  matching existing feature patterns.
- Each public mutation maps to one explicit command. Where two requested service
  facades refer to reassignment, both delegate to one canonical assignment
  command coordinator; only one public mutation contract is exposed.

### Authorization and mutation envelope

- `requireAdminActor()` loads the current application actor and rejects missing,
  inactive, or non-admin actors.
- Shared Zod schemas define a 10-500 character reason, UUID parameters,
  bounded cursor pagination, date ranges, enum filters, and idempotency header.
- Every admin mutation uses a command envelope containing actor, reason,
  idempotency key, request hash, and target.

### Repository design

- Existing domain repository contracts receive only methods that are valid
  outside admin queries, such as row-lock variants and explicit status changes.
- `AdminQueryRepository` owns cross-domain, paginated, redacted read models and
  aggregate queries.
- `AdminInternalNoteRepository`, `AdminSupervisionRepository`, and optional
  `AdminConfigurationRepository` own new admin-only records.
- PostgreSQL and in-memory implementations are added to `FoundationRepositories`
  so every service runs through the existing UnitOfWork.
- Repository list methods use cursor ordering by stable timestamp plus UUID,
  never unbounded reads.

### Concurrency and idempotency

- All admin mutations require `X-Idempotency-Key` and reuse the existing
  idempotency record lifecycle with an admin command-specific scope.
- Last-active-admin protection uses a shared transaction advisory lock before
  locking/re-counting active admin memberships and changing account status or
  roles. This serializes concurrent last-admin mutations without a new lock
  table.
- Manual assignment, reassignment, round expiry, retry, notification
  cancellation, dead-letter retry, and reminder retry lock all contested rows
  and re-check state before mutation.
- Existing unique indexes remain the final protection for one active assignment
  per request and mechanic.

### Audit, outbox, and privacy

- `audit_logs` gains an optional dedicated `admin_reason` field constrained to
  10-500 characters. It remains append-only and avoids putting free text into
  metadata JSON.
- Admin audit metadata contains only IDs, status codes, command codes, and safe
  counts.
- Internal-note content is stored only in the note table. Audit/outbox record the
  note ID and target, never note text.
- Audit export leaves all source audit rows unchanged but appends one separate
  sanitized access-audit event containing actor, filter hash, record count, and
  timestamp; exported content is never copied into that event.
- Central `toAdminSafe*` mappers and `redactAdminPayload()` apply defense in
  depth to list/detail/export payloads. Existing DB prohibited-metadata checks
  remain active.

### Manual assignment and reassignment

- Manual assignments are first-class assignment provenance, not synthetic
  offers or fake dispatch candidates.
- Assignments gain an `assignment_source`, optional accepted candidate,
  optional assigning admin, and optional superseded assignment.
- Offer-accepted assignments still require a valid accepted candidate.
- Admin-manual assignments require an assigning admin and no accepted candidate.
- Manual assignment accepts requests in explicitly allowlisted assignable
  states, including manual escalation when all mechanic eligibility rules pass.
- Reassignment is limited to pre-diagnosis active assignment states. It cancels
  the prior assignment, creates one replacement assignment, preserves history,
  and leaves exactly one active assignment.

### Mechanic and quote supervision

- Pending mechanic rejection becomes a durable `rejected` profile status.
- Banned mechanics cannot use generic reactivation.
- Ratings remain read-only trusted aggregates.
- Diagnosis/quote revision and dispute commands append admin supervision action
  records; they never edit used diagnosis or quote content.
- Pending quote void uses an explicit `voided` terminal quote status; expiry uses
  the existing `expired` status.

### Delivery and reminder recovery

- Notification cancellation gains a durable `canceled` status and cancels only
  a not-yet-delivered related outbox event.
- Outbox abandon gains a durable `abandoned` status; dead-letter retry clears
  failure/lease metadata and schedules one controlled retry.
- Processed events are never retried.
- Reminder retry is allowed only for failed occurrences and uses the existing
  occurrence identity/dedupe semantics.

### Operational dashboard and configuration

- Dashboard values are read-only aggregate queries; no persisted dashboard table
  is introduced.
- Stuck-workflow thresholds remain named policy constants in Patch I and are not
  mutable through Patch J.
- Optional configuration stores only the four typed, non-secret dispatch keys
  defined in the specification, with version history. Provider budget values
  are read-only metadata; feature-flag, provider-budget, maintenance-mode, and
  chatbot/provider behavior mutations are excluded.

## Project Structure

### Documentation

```text
specs/003-careonroad-admin-operations/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- admin-api.yaml
`-- tasks.md
```

### Source Code

```text
app/
`-- api/v1/admin/
    |-- users/
    |-- devices/
    |-- mechanics/
    |-- service-requests/
    |-- dispatch/
    |-- assignments/
    |-- diagnoses/
    |-- quotes/
    |-- reminders/
    |-- notifications/
    |-- outbox/
    |-- audit/
    |-- dashboard/
    `-- configuration/

src/
|-- features/admin/
|   |-- admin.schemas.ts
|   |-- admin.authorization.ts
|   |-- admin-redaction.ts
|   |-- admin-route-helpers.ts
|   |-- admin-*.route-handlers.ts
|   |-- admin-user-management.service.ts
|   |-- admin-mechanic-management.service.ts
|   |-- admin-service-request.service.ts
|   |-- admin-dispatch-operations.service.ts
|   |-- admin-assignment-operations.service.ts
|   |-- admin-diagnosis-quote.service.ts
|   |-- admin-reminder-management.service.ts
|   |-- admin-notification-operations.service.ts
|   |-- admin-outbox-operations.service.ts
|   |-- admin-audit-query.service.ts
|   |-- admin-dashboard.service.ts
|   |-- admin-configuration.service.ts
|   `-- __tests__/
|-- features/assignments/
|-- features/auth/
|-- features/dispatch/
|-- features/notifications/
|-- features/outbox/
|-- features/quotes/
|-- features/reminders/
`-- features/service-requests/

src/server/repositories/
|-- contracts/
|   |-- admin-query.repository.ts
|   |-- admin-internal-note.repository.ts
|   |-- admin-supervision.repository.ts
|   `-- admin-configuration.repository.ts
|-- postgres/
|   |-- admin-query.repository.ts
|   |-- admin-internal-note.repository.ts
|   |-- admin-supervision.repository.ts
|   `-- admin-configuration.repository.ts
`-- testing/
    |-- in-memory-admin-query.repository.ts
    |-- in-memory-admin-internal-note.repository.ts
    |-- in-memory-admin-supervision.repository.ts
    `-- in-memory-admin-configuration.repository.ts

supabase/migrations/
|-- 202606250015_admin_foundation.sql
|-- 202606250016_admin_mechanic_management.sql
|-- 202606250017_admin_dispatch_assignment_operations.sql
|-- 202606250018_admin_quote_status.sql
|-- 202606250019_admin_supervision_actions.sql
|-- 202606250020_admin_delivery_statuses.sql
|-- 202606250021_admin_delivery_operations.sql
`-- 202606250022_admin_operation_configs.sql
```

**Structure Decision**: Extend the existing modular monolith. Admin feature
services own authorization and orchestration while existing domain services,
state helpers, repository contracts, and database constraints remain the source
of truth. No new application, frontend tree, or dependency is introduced.

## Proposed Migrations

| Migration | Patch | Additive change |
|---|---|---|
| `202606250015_admin_foundation.sql` | A/B/D/F | Add `audit_logs.admin_reason`; add append-only `admin_internal_notes`; add admin query indexes; keep direct authenticated writes revoked and RLS enabled. |
| `202606250016_admin_mechanic_management.sql` | C | Add `rejected` mechanic profile status and bounded admin-list indexes; retain rating constraints. |
| `202606250017_admin_dispatch_assignment_operations.sql` | E/F | Add assignment provenance/source, assigning admin, superseded assignment reference, nullable candidate with source-dependent constraints; replace candidate identity trigger safely. |
| `202606250018_admin_quote_status.sql` | G | Add only the `voided` quote enum value and commit it before any trigger or constraint uses the new value. |
| `202606250019_admin_supervision_actions.sql` | G | Add append-only diagnosis/quote supervision records and replace quote transition enforcement to allow pending-to-voided. |
| `202606250020_admin_delivery_statuses.sql` | H | Add only notification `canceled` and outbox `abandoned` enum values and commit them before use. |
| `202606250021_admin_delivery_operations.sql` | H | Add delivery terminal provenance, constraints, worker claim rules, and indexes that use the committed enum values. |
| `202606250022_admin_operation_configs.sql` | J optional | Add current/version records and indexes for the four allowlisted non-secret dispatch configuration keys only. |

No migration in this admin-operations plan is named or reserved for payment.
Payment now lives in feature 005 with its own later migration. If Patch J is
deferred, migration 022 is not created until that patch is authorized; later
migrations must still use a timestamp greater than the then-current latest
migration.

## Patch Sequence

### Patch A - Admin foundation, authorization, schemas, notes, and redaction

- Add admin feature directory, active-admin authorization helper, typed admin
  errors, reason/idempotency/pagination/filter schemas, and route test utilities.
- Add admin-safe DTO/redaction helpers and prohibit sensitive keys recursively.
- Add migration 015, note/audit repository contracts, PostgreSQL/in-memory
  adapters, and UnitOfWork registration.
- Add migration, authorization, reason, idempotency, rollback, redaction,
  pagination, audit, and outbox foundation tests.
- No domain-specific command endpoint is enabled.

### Patch B - Admin user management

- Implement paginated user list/detail, device list, and activity timeline.
- Implement suspend/reactivate/archive, device revoke, and role grant/revoke.
- Serialize and enforce last-active-admin protection.
- Add thin `/api/v1/admin/users` and `/api/v1/admin/devices` adapters.
- Test 401 missing/invalid token, 403 non-admin, admin success, reason required,
  idempotent replay, rollback, no hard delete, last-admin races, and redaction.

### Patch C - Admin mechanic management

- Apply migration 016.
- Implement list/detail, approve/reject/suspend/ban/reactivate, skill/radius
  updates, force unavailable, work history, and performance read models.
- Reuse service type/radius/location/workload rules and keep rating immutable.
- Add route/service/integration tests for status transitions, active-assignment
  conflicts, invalid filters, rollback, audit/outbox, and absence of rating
  mutation.

### Patch D - Admin service-request operations

- Implement request list/detail/timeline, metadata-only media, assignment/quote
  relationship views, cancel, manual escalation, and internal notes.
- Reconcile open dispatch rows on cancel/escalation in the same transaction.
- Add routes and tests for state policy, notes privacy, no arbitrary status
  setter, rollback, audit/outbox, filters, and no raw media.

### Patch E - Admin dispatch operations

- Apply migration 017 assignment provenance needed by manual assignment.
- Implement status/round/detail, overdue expiry, retry, cancel, eligible
  mechanic list, categorized failure explanation, and manual assignment.
- Delegate request-based reassignment to the canonical assignment coordinator.
- Add contested tests for expiry versus accept, retry versus active round,
  manual assignment races, stale state, every failure category, locks,
  rollback, audit/outbox, and uniqueness.

### Patch F - Admin assignment operations

- Implement detail/timeline, cancel, canonical reassign, allowlisted stuck
  resolution actions, and internal notes.
- Preserve old assignments and histories during reassignment.
- Add state-machine, request-sync, concurrent reassignment, invalid action,
  no-force-status, rollback, note privacy, audit/outbox, and integration tests.

### Patch G - Admin diagnosis and quote supervision

- Apply migrations 018 then 019 so the quote enum value commits before trigger
  logic uses it.
- Implement redacted diagnosis detail, quote version history, revision requests,
  pending quote void/expiry, and explicit dispute resolutions.
- Keep diagnosis and quote content immutable; financial revision continues
  through existing quote version creation.
- Test quote/rider-decision races, latest-pending checks, append-only
  supervision, no full text in audit/outbox, and no direct content edits.

### Patch H - Admin audit, notification, outbox, and reminder operations

- Apply migrations 020 then 021 so delivery enum values commit before
  constraints, indexes, and repository commands use them.
- Implement source-row-preserving audit queries and an audited export command
  that appends exactly one sanitized export-access audit record per successful
  export, plus admin action history.
- Implement notification list/detail/summary, failed retry, and pending cancel.
- Implement outbox list/detail/dead-letter/health, retry, and abandon.
- Implement reminder list/detail/occurrences/health, enable/disable, and failed
  occurrence retry.
- Test that audit queries do not mutate source rows; successful export preserves
  source rows and appends exactly one sanitized access record without exported
  content; also test redaction, export bounds, lease races, dedupe, no manual
  sent state, no duplicate domain mutation, and no odometer behavior.

### Patch I - Admin dashboard

- Implement operational summary and bounded dispatch, assignment, mechanic,
  request, and worker metrics.
- Implement six required stuck-workflow categories with deterministic reason
  codes and safe next-command categories.
- Add aggregate reconciliation, threshold-boundary, duplicate-finding, read-only,
  pagination, and performance smoke tests.
- Add no dashboard persistence table.

### Patch J - Admin configuration (optional)

- Apply migration 022 only when this optional patch is authorized.
- Implement only these mutable dispatch keys and bounds:
  - `dispatch.radius_steps_km`: 1 to 8 ascending values, each 1 to 100 km,
    default `[2, 5, 8, 12]`;
  - `dispatch.offer_expiry_seconds`: integer 30 to 300, default `60`;
  - `dispatch.max_rounds`: integer 1 to 8, default `4`;
  - `dispatch.total_wait_seconds`: integer 60 to 1,800, greater than or equal to
    offer expiry, default `360`.
- Expose provider budget limits and usage only as read-only metadata. Do not
  expose feature-flag, provider-budget, or chatbot/provider behavior mutations.
- Defer maintenance mode unless a later explicit policy defines blocked and
  allowed command categories, HTTP error behavior, active-workflow effects, and
  proves authentication, worker authorization, chatbot safety, ASR behavior,
  and emergency advice remain intact.
- Keep credentials in existing secret configuration, never in operational
  config.
- Test exact-key allowlisting, types, bounds, ascending radius steps,
  cross-field total-wait validation, provider-budget read-only behavior,
  rejected feature-flag/provider-budget/maintenance mutations, version history,
  audit/outbox, rollback, and secret rejection.

## Test and Verification Strategy

Every patch follows tests-first task ordering and includes:

1. Route authorization matrix: missing auth 401, invalid token 401, inactive or
   non-admin 403, active admin success.
2. Mutation validation: missing/empty/short/oversized reason and missing/invalid
   idempotency key rejected.
3. Service unit tests: valid command, invalid state, stale state, replay,
   rollback, no hard delete, audit, outbox, and sanitized metadata.
4. Repository contract tests for cursor pagination, locks, state updates, and
   redacted mappings.
5. PostgreSQL integration tests for migrations, constraints, concurrent
   commands, triggers, indexes, and RLS/direct access boundaries.
6. Static tests proving no admin route contains `forceStatus`, rating setters,
   payment artifacts, or sensitive DTO fields.
7. PostgreSQL-backed performance acceptance tests exercise every bounded admin
   list/detail operation after five warm-ups, run 20 measured requests per
   operation, require at least 19 of 20 within two seconds, and assert response
   bounds against the agreed MVP dataset.
8. Full regression: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`,
   and `npm.cmd run build`.

## Operational Rollout

- Admin routes are unavailable until migrations for their patch are applied.
- Patch A lands without domain command routes.
- Patches B-I can be enabled sequentially after focused tests and hosted/dev
  migration verification.
- Patch J is disabled unless explicitly configured after migration 022.
- No mock-data seed targets production. Admin fixtures remain test/dev-only.
- Audit/outbox health and stuck-workflow results are checked before expanding
  administrator access.

## Complexity Tracking

No constitution violation requires justification. The additional admin
repositories and migrations are limited to data that cannot be safely derived
from existing history: internal notes, assignment provenance, supervision
actions, delivery terminal outcomes, and optional configuration.
