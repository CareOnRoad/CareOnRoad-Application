# Implementation Plan: CareOnRoad Backend MVP

**Branch**: `002-careonroad-backend-mvp` | **Date**: 2026-06-25 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from
`/specs/002-careonroad-backend-mvp/spec.md`

## Summary

Extend the current DEMO_AI Next.js modular monolith with backend-only CareOnRoad
modules for Supabase-authenticated users, rider motorcycles, service requests,
dispatch, atomic assignments, mechanic diagnosis, immutable quote versions,
date/time-based reminders that are not odometer-based, transactional
notifications/outbox, sanitized audit records, compatible chatbot persistence,
admin operations, mechanic operations metadata, and feature 005 backend-only
payOS/VietQR payment orders.

The implementation uses `/api/v1` route adapters, feature-owned application
services, repository interfaces with transaction-scoped PostgreSQL
implementations, and versioned Supabase migrations. Existing chatbot and ASR
routes, providers, safety behavior, fallback, post-validation, UI, and tests are
preserved.

Constitution version 1.1.0 authorizes this backend-only scope while preserving
the existing AI safety rules and excluding frontend workflows, production
payment settlement/refunds, live dispatch/tracking UI, and AI-only automatic
service actions.

## Technical Context

**Language/Version**: TypeScript 5.6+ on Node.js through Next.js App Router

**Primary Dependencies**:

- Existing: Next.js 15, React 19, Zod 3, Vitest 2, local sherpa-onnx,
  Gemini/OpenRouter clients.
- Approved and installed baseline: `postgres` for transactional SQL and `jose`
  for Supabase JWT/JWKS verification.
- Supabase CLI for linked hosted migration inspection and push workflows. A
  local Supabase stack is optional future operational tooling, not a Patch 2
  blocker.

**Storage**: Supabase-managed PostgreSQL with PostGIS. Repository-backed
persistence is mandatory for existing chatbot sessions, messages, and
diagnosis results without changing external chatbot behavior.

**Testing**: Vitest unit/route tests, repository contract tests, PostgreSQL
integration/concurrency tests against disposable schemas on the linked hosted
database or another isolated test database; mocked notification and payment
provider adapters.

**Target Platform**: Existing Next.js Node.js server runtime; local development
and deployable persistent/serverless Node environments with an appropriate
Supabase connection mode.

**Project Type**: Existing full-stack web application with new backend-only API
surface.

**Performance Smoke Goals**:

- Performance smoke checks are local regression guards in the configured test
  environment, not production p95, capacity, or readiness claims.
- Auth/profile and representative CRUD smoke checks use 20 deterministic
  operations with a generous local regression threshold of 30 seconds for the
  complete scenario.
- Dispatch smoke checks use 50 deterministic mechanic profiles, including 10
  active assignments plus missing/stale-location fixtures. Candidate generation
  must complete within a generous local regression threshold of 30 seconds.
- Contested-assignment smoke checks use five concurrent accept pairs and must
  complete within 30 seconds with no deadlock residue or invariant violation.
- Worker smoke checks use two peers and 20 deterministic leased events. Both
  peers must make progress and complete the scenario within 30 seconds.
- Chatbot latency smoke checks use 20 deterministic mocked-provider requests.
  Repository-backed persistence must not increase median latency by more than
  250 milliseconds or three times the in-memory baseline, whichever allowance
  is greater.

**Constraints**:

- No new backend project.
- No frontend UI changes.
- No movement or rewrite of chatbot/ASR modules unless compatibility requires a
  minimal change.
- Existing in-memory chatbot session storage and rate limiting remain available
  as compatible local/test adapters alongside mandatory repository-backed
  chatbot persistence.
- No secrets in frontend, responses, logs, fixtures, or committed files.
- Raw audio remains local.
- All contested workflows use transactions and database constraints.
- External notification providers are adapter-based. Payment provider work is
  implemented through the feature 005 payOS adapter.
- Existing tests do not call real remote AI or ONNX.

**Scale/Scope**:

- Pilot backend for one city/region.
- Tens of thousands of users and motorcycles.
- Hundreds of concurrent active service requests.
- Moderate append-only audit/outbox volume, including feature 005 payment
  events.
- One application deployment with workers invoked by protected endpoint,
  scheduled command, or platform scheduler.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- Advisory AI output: **PASS**. Feature 002 does not change chatbot output,
  estimates, or disclaimers.
- Backend-controlled AI safety: **PASS**. Existing safety gate, provider chain,
  schema validation, post-validation, fallback, rate limit, and logging remain
  backend-owned and unchanged.
- Secret isolation: **PASS**. Existing AI keys, Supabase/database credentials,
  and payOS credentials remain backend-only.
- Vietnamese-first chatbot: **PASS**. Existing chatbot behavior is preserved.
- Validated JSON or safe fallback: **PASS**. Existing provider validation and
  local fallback remain mandatory.
- Existing required chatbot tests: **PASS BY DESIGN**. All current tests remain
  in the verification suite.
- Backend-only workflow scope: **PASS**. Constitution 1.1.0 authorizes auth,
  motorcycles, service requests, dispatch, assignment, mechanic diagnosis,
  versioned quotes, date/time-based reminders that are not odometer-based,
  persistence, outbox, notifications, audit, repositories, migrations, admin
  operations, mechanic operations, and feature 005 payment adapter/webhooks.
- Excluded scope: **PASS**. The plan adds no frontend workflows, production
  payment checkout/settlement/refunds, inventory commerce, odometer reminders,
  live dispatch/tracking UI, chatbot/voice rewrite, or AI-only automatic
  booking, assignment, quote approval, or payment.
- Workflow integrity: **PASS**. RBAC, ownership, transaction constraints,
  idempotency, webhook replay protection, outbox, audit, and migration tests are
  explicit.

**Gate result**: PASS. Feature 002 is constitution-compliant and may proceed to
analysis and task generation.

## Project Structure

### Documentation

```text
specs/002-careonroad-backend-mvp/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── backend-api.yaml
└── tasks.md                    # Created later by speckit-tasks
```

### Proposed Source Structure

```text
app/
├── api/
│   ├── chatbot/                # Existing; unchanged
│   └── v1/
│       ├── auth/
│       │   ├── me/route.ts
│       │   ├── profile/route.ts
│       │   └── devices/route.ts
│       ├── motorcycles/
│       │   ├── route.ts
│       │   └── [motorcycleId]/route.ts
│       ├── service-requests/
│       │   ├── route.ts
│       │   └── [requestId]/
│       │       ├── route.ts
│       │       ├── cancel/route.ts
│       │       ├── dispatch/route.ts
│       │       ├── media/route.ts
│       │       └── quotes/route.ts
│       ├── mechanics/
│       │   └── me/
│       │       ├── profile/route.ts
│       │       ├── availability/route.ts
│       │       └── location/route.ts
│       ├── dispatch/
│       │   └── offers/
│       │       ├── route.ts
│       │       └── [offerId]/
│       │           ├── accept/route.ts
│       │           └── decline/route.ts
│       ├── assignments/
│       │   ├── route.ts
│       │   └── [assignmentId]/
│       │       ├── status/route.ts
│       │       └── diagnoses/route.ts
│       ├── quotes/
│       │   └── [quoteId]/
│       │       ├── approve/route.ts
│       │       └── reject/route.ts
│       ├── payments/
│       │   ├── orders/
│       │   │   ├── route.ts
│       │   │   └── [paymentOrderId]/route.ts
│       │   └── webhooks/[provider]/route.ts
│       ├── reminders/
│       │   ├── route.ts
│       │   └── [reminderId]/
│       │       ├── route.ts
│       │       └── snooze/route.ts
│       └── internal/workers/
│           ├── reminders/run/route.ts
│           └── outbox/run/route.ts
└── page.tsx                    # Existing; unchanged

src/
├── features/
│   ├── chatbot/                # Existing behavior preserved; persistence adapter allowed
│   ├── asr/                    # Existing; unchanged
│   ├── auth/
│   │   ├── auth.types.ts
│   │   ├── auth.schemas.ts
│   │   ├── auth.service.ts
│   │   ├── authorization.ts
│   │   └── __tests__/
│   ├── motorcycles/
│   ├── service-requests/
│   ├── dispatch/
│   ├── assignments/
│   ├── mechanic-diagnosis/
│   ├── quotes/
│   ├── payments/
│   ├── reminders/
│   ├── notifications/
│   ├── outbox/
│   └── audit/
├── server/
│   ├── auth/
│   │   ├── supabase-jwt-verifier.ts
│   │   └── request-actor.ts
│   ├── db/
│   │   ├── postgres-client.ts
│   │   ├── transaction.ts
│   │   └── database-errors.ts
│   ├── repositories/
│   │   ├── contracts/
│   │   │   ├── unit-of-work.ts
│   │   │   ├── user.repository.ts
│   │   │   ├── motorcycle.repository.ts
│   │   │   ├── service-request.repository.ts
│   │   │   ├── dispatch.repository.ts
│   │   │   ├── assignment.repository.ts
│   │   │   ├── diagnosis.repository.ts
│   │   │   ├── quote.repository.ts
│   │   │   ├── payment.repository.ts
│   │   │   ├── reminder.repository.ts
│   │   │   ├── notification.repository.ts
│   │   │   ├── outbox.repository.ts
│   │   │   ├── audit.repository.ts
│   │   │   ├── idempotency.repository.ts
│   │   │   └── chatbot-session.repository.ts
│   │   ├── postgres/
│   │   │   ├── postgres-unit-of-work.ts
│   │   │   └── *.repository.ts
│   │   └── testing/
│   │       └── in-memory-*.repository.ts
│   ├── payments/
│   │   ├── payment-provider.ts
│   │   └── payment-provider-registry.ts
│   └── workers/
│       ├── reminder.worker.ts
│       └── outbox.worker.ts
└── lib/
    ├── api-error.ts            # Existing; extend only if needed
    ├── server-logger.ts        # Existing; extend sanitization only if needed
    ├── idempotency.ts
    └── pagination.ts

supabase/
├── migrations/
│   ├── 202606250001_enable_extensions.sql
│   ├── 202606250002_outbox_audit_idempotency.sql
│   ├── 202606250003_rls_foundation.sql
│   ├── 202606250004_identity_and_roles.sql
│   ├── 202606250005_user_devices.sql
│   ├── 202606250006_motorcycles_and_mechanics.sql
│   ├── 202606250007_service_requests.sql
│   ├── 202606250008_dispatch_candidates.sql
│   ├── 202606250009_assignments.sql
│   ├── 202606250010_diagnoses_and_quotes.sql
│   ├── 202606250011_reminders.sql
│   ├── 202606250012_notifications_outbox_audit.sql
│   ├── 202606250013_chatbot_persistence.sql
│   ├── 202606250014_indexes_constraints_rls.sql
│   ├── 202606250015_admin_foundation.sql
│   ├── 202606250016_admin_mechanic_management.sql
│   ├── 202606250017_assignment_eta_metadata.sql
│   ├── 202606250018_assignment_media_metadata.sql
│   └── 202606250019_assignment_completion_checklists.sql
└── seed.sql                     # Non-secret roles/service types only
```

**Structure Decision**: Keep one Next.js repository and deployment. New route
files are adapters only. Feature services own validation and state transitions.
Repository contracts isolate persistence; PostgreSQL implementations own SQL
and locking. Transaction-scoped unit-of-work coordinates cross-module writes.

## Design Decisions

### Authentication and Authorization

- `Authorization: Bearer <Supabase access token>`.
- Verify JWT through JWKS using `jose`.
- JWKS verification uses the explicit algorithm allowlist configured by the
  backend verifier. The artifact does not declare broader algorithm support
  than the implementation and tests demonstrate.
- `none`, `HS256` on the JWKS path, unsupported algorithms, key/algorithm
  mismatches, and algorithm-confusion attempts are rejected.
- Legacy `HS256` support requires a separately selected Supabase Auth-server
  verification mode with no automatic fallback from JWKS verification.
- Load application user and roles from PostgreSQL.
- Use `RequestActor` in service calls.
- Enforce role, ownership, and resource state in every service.
- Return `403` for role or ownership denial and `404` only when the resource is
  absent.

### Transactions and Concurrency

- Database transaction is the unit of consistency.
- Use row locks on request, offer, assignment set, quote stream, payment order,
  reminder occurrence, and outbox claim as appropriate.
- Use partial unique indexes for active assignment invariants.
- Route parsing, Zod validation, and application-level input validation failures
  return `400 INVALID_INPUT`.
- Non-conflict PostgreSQL integrity-constraint failures return
  `422 DATABASE_CONSTRAINT_VIOLATION`.
- Application-detected workflow, replay, active-work, transition, and stale
  state conflicts return `409 CONFLICT`.
- Database-detected unique, exclusion, serialization, and exhausted deadlock
  conflicts return `409 DATABASE_CONFLICT`.
- This mapping preserves Patch 1-4 behavior and requires no completed-code
  changes.
- Return `401` for missing/invalid authentication, `403` for role/ownership
  denial, and `404` for absent resources.
- Retry only safe transaction failures with bounded attempts.

### Normative State Machines

- The closed service-request and assignment status enums, allowed transitions,
  terminal states, actor/system authority, controlled conflict behavior, and
  atomic history/audit/outbox requirements are defined by FR-008 through
  FR-008D.
- Each implementation patch implements and tests only its applicable subset.
  Patch 3 owns request creation, rider cancellation before assignment, and
  request transition foundations. Patch 4 owns dispatch/offering/manual
  escalation, assignment acceptance, and its applicable assignment progress
  transitions. Later states become operational only in their authorized
  dependent patches.
- Illegal, stale, or unauthorized transitions leave no history, audit, or
  outbox residue.
- Pending transition triggers are owned as follows:

  | Patch | Trigger | Assignment/request effect |
  |---|---|---|
  | Patch 4 | First valid offer acceptance | Assignment starts `accepted`; request moves `offered -> assigned`. |
  | Patch 5 | Authorized assignment progress route | Assignment may progress `accepted -> en_route -> on_site -> diagnosis`; request synchronizes to `mechanic_en_route` and then `in_service`. |
  | Patch 5 | Diagnosis create/revise | No automatic assignment/request transition; authorization, `on_site|diagnosis` state, locking, and quote-reference immutability remain mandatory. |
  | Patch 5 | First quote creation | Assignment `diagnosis -> quoted`; request `in_service -> awaiting_quote_approval`. |
  | Patch 5 | Later quote version | Assignment remains `quoted`; request remains `awaiting_quote_approval`. |
  | Patch 5 | Latest quote approval | Assignment `quoted -> awaiting_payment`; request `awaiting_quote_approval -> awaiting_payment`; no payment order or fund movement is initiated. |
  | Patch 5 | Latest quote rejection | Quote becomes rejected; assignment/request stay `quoted`/`awaiting_quote_approval` for a newer version. |
  | Patch 6 | Verified matching payment success | Payment `pending -> succeeded`; only then may authorized assignment progress move `awaiting_payment -> in_progress` after verifying succeeded payment. |
  | Patch 7 | Reminder-originated request creation | Standard service-request creation produces `submitted` and retains ownership, due-occurrence, and idempotency checks. |

- Rider cancellation remains pre-assignment only. Assigned-state cancellation
  requires a dedicated workflow authorized for the assigned mechanic or admin;
  Patch 5 does not add it, and it remains unavailable until an explicit task is
  authorized.

### Deterministic Dispatch Policy

- `initial_radius_km = 2`
- `radius_steps_km = [2, 5, 8, 12]`
- `max_radius_km = 12`
- `offer_ttl_seconds = 60`
- `max_dispatch_rounds = 4`
- `candidate_batch_size = 10`
- `max_total_dispatch_wait_seconds = 360`
- `location_max_age_seconds = 300`
- Candidate statuses form the closed MVP enum defined once in the feature
  specification at FR-010B. Any addition requires a spec and migration
  amendment.
- Active workload conflicts are `accepted`, `en_route`, `on_site`, `diagnosis`,
  `quoted`, `awaiting_payment`, and `in_progress`.
- For MVP, `is_available = true` represents both online and accepting jobs.
- Mechanic profiles own `profile_status`, `service_radius_km`, latest-location
  timestamps, availability timestamp, and read-only `rating_avg`/`rating_count`
  defaults. Mechanics cannot edit rating fields; Patch 2 adds no review module.
- Candidate eligibility requires `profile_status = active`,
  `is_available = true`, a matching broad `service_type` skill, a fresh latest
  location, and no assignment in an active-conflict state. Eligible candidates
  are ordered by nearest distance, higher `rating_avg`, earliest
  `availability_updated_at`, then `mechanic_user_id` ascending. A zero
  `rating_count` remains rankable and uses the stored default `rating_avg = 0`.
- Candidate selection excludes mechanics without a latest location or with
  `location_updated_at` older than 300 seconds.

### Outbox and Audit

- Domain mutation, outbox event, and audit record commit together.
- Worker claims use leases and `FOR UPDATE SKIP LOCKED`.
- Dedupe keys are stable by business occurrence.
- Audit metadata passes a server-side sanitizer before insert.
- Read-only operations create neither audit nor outbox records.
- Privacy-sensitive values are sanitized before audit or outbox persistence.

#### Mutation-to-Audit/Outbox Matrix

`Atomic` means the domain mutation and every required audit/outbox row commit in
one transaction. An outbox event is not required for the notification
delivery-status-only updates identified below because those updates are already
the terminal processing state of an existing outbox event.

| Mutation | Audit | Outbox | Atomic | Required behavior |
|---|---|---|---|---|
| User/profile bootstrap | Yes | Yes | Yes | Emit metadata-only profile bootstrap event |
| User device registration | Yes | Yes | Yes | Store sanitized device identifier metadata only |
| Motorcycle create/update/delete | Yes | Yes | Yes | Preserve ownership and archive semantics |
| Mechanic profile update | Yes | Yes | Yes | Include changed capability metadata only |
| Mechanic availability/location update | Yes | Yes | Yes | Location payload must be reduced/sanitized |
| Service request create/cancel/status transition | Yes | Yes | Yes | Include request history in the same transaction |
| Request media metadata add | Yes | Yes | Yes | Persist object metadata/reference, never raw media |
| Dispatch candidate created/offered/expired | Yes | Yes | Yes | Use stable candidate/round dedupe keys |
| Mechanic accept assignment | Yes | Yes | Yes | Include request, candidate, assignment, and history writes |
| Assignment status transition | Yes | Yes | Yes | Include assignment history |
| Mechanic diagnosis create/revise | Yes | Yes | Yes | One current diagnosis per assignment; pre-quote revision only; lock and re-check assignment/diagnosis; audit/outbox must not contain full diagnosis text |
| Quote create/update/accept/reject | Yes | Yes | Yes | Update means a new immutable version |
| Payment order create | Yes | Yes | Yes | Include idempotency completion |
| Payment webhook processed | Yes | Yes | Yes | Include provider-event deduplication |
| Reminder rule create/update/snooze | Yes | Yes | Yes | Preserve owned-rule state |
| Reminder job generated/queued | Yes | Yes | Yes | Use occurrence and job/outbox dedupe keys |
| Notification created | Yes | Yes | Yes | Creation is driven by a business event |
| Notification marked sent/failed | Yes | No | Yes | Terminal delivery-state update; do not create recursive outbox work |
| Chatbot session/message/diagnosis persistence | Yes | Yes | Yes | Metadata-only event; no raw audio, secrets, or full chatbot text |

All state-changing service and integration tests MUST verify the applicable row
in this matrix. Read-only operations are excluded.

### API and Errors

- New endpoints use `/api/v1`.
- Request and response validation uses Zod.
- `X-Idempotency-Key` is required for service-request creation, admin command
  mutations, and mechanic assignment metadata mutations (ETA/media/checklist).
  Motorcycle mutations, offer acceptance, and quote approve/reject do not
  require this client header. Offer acceptance is race-safe by locked
  candidate/request/assignment state; quote decisions use ownership and
  latest-version conflicts. Payment order creation is idempotent, and payOS
  webhooks are deduped by provider event key.
- Route parsing, Zod validation, and application-level input validation failures
  return `400 INVALID_INPUT`.
- Non-conflict PostgreSQL integrity-constraint failures return
  `422 DATABASE_CONSTRAINT_VIOLATION`.
- Application-detected workflow, replay, active-work, transition, and stale
  state conflicts return `409 CONFLICT`.
- Database-detected unique, exclusion, serialization, and exhausted deadlock
  conflicts return `409 DATABASE_CONFLICT`.
- Missing or invalid authentication returns `401`; suspended actors,
  role/ownership denial, and object-level authorization denial return `403`;
  missing resources return `404`; database unavailability returns `503`; and
  unexpected failures return controlled `500` responses.
- Route tests assert only boundaries applicable to the route contract:
  missing/invalid bearer authentication, worker authority, role denial,
  ownership denial, absence, validation, conflict/replay, and valid-authority
  success. Signed provider webhooks use signature verification rather than
  bearer authentication. Tests do not manufacture inapplicable cases, and every
  controlled failure asserts its stable error code.
- Controlled error body:

```json
{
  "error_code": "CONFLICT",
  "message": "The request was already assigned.",
  "request_id": "..."
}
```

#### Canonical Patch 1-4 `/api/v1` Error Codes

| HTTP status | Error code | Current required use |
|---|---|---|
| 400 | `INVALID_INPUT` | Route parsing, schema, field, or application input validation failure |
| 401 | `UNAUTHORIZED` | Missing authentication |
| 401 | `INVALID_TOKEN` | Invalid or unverifiable authentication token |
| 403 | `ACTOR_SUSPENDED` | Authenticated suspended actor |
| 403 | `FORBIDDEN` | Role, ownership, candidate, assignment, or object-level authorization denial |
| 404 | `NOT_FOUND` | Application profile or requested domain resource is absent |
| 409 | `CONFLICT` | Application-detected state, active-work, idempotency, transition, expiry, or stale-resource conflict |
| 409 | `DATABASE_CONFLICT` | Database-detected unique, exclusion, serialization, or exhausted deadlock conflict |
| 422 | `DATABASE_CONSTRAINT_VIOLATION` | Non-conflict PostgreSQL integrity-constraint violation |
| 503 | `DATABASE_UNAVAILABLE` | Database connection or availability failure |
| 500 | `DATABASE_ERROR` | Controlled unexpected database failure |
| 500 | `INTERNAL_ERROR` | Controlled unexpected application failure |

Completed Patch 1-4 tasks and tests retain their existing wording and evidence.
Where a pending task requires a stable error code, it MUST assert the exact code
from this table. New or more specific domain error codes require an explicit
specification, contract, implementation, and test amendment.

- Route handlers parse HTTP concerns and delegate to feature services.

### Database Access and RLS

- Migrations and persistent server traffic prefer direct/session connections.
- Short-lived runtimes may use transaction-pooler mode with compatible client
  settings.
- Domain tables enable RLS and deny direct writes by default.
- Backend authorization remains mandatory even when RLS applies.

## Patch Order

### Governance prerequisite — completed 2026-06-25

Constitution 1.1.0 and dependent templates authorize feature 002 while
retaining chatbot safety, secret isolation, fallback, post-validation, local
ASR, and privacy-safe logging requirements.

### Patch 1 — Auth, database, repository, and transactional foundation (completed)

- Use the approved `postgres` and `jose` dependency baseline.
- Add server-only database and Supabase JWT configuration to `.env.example`.
- Add PostgreSQL client/transaction helpers.
- Add JWT verifier and `RequestActor`.
- Add repository contracts and `UnitOfWork`.
- Add initial migrations for extensions, users/roles, idempotency, outbox, audit,
  constraints, and baseline RLS.
- Implement `GET /api/v1/auth/me`, `POST /api/v1/auth/profile`, and backend-only
  user-device registration.
- Add unit, route, repository contract, migration, and secret-sanitization tests.

The live PostgreSQL foundation integration gate passed on 2026-06-25 against
the linked Supabase hosted development database through its session pooler.
Tests use disposable `careonroad_test_*` schemas and remove temporary fixtures
after execution, so the application schema and data are not used as test state.

This completed foundation patch provides the actor identity, transaction
boundaries, persistence contracts, idempotency, outbox, and audit required by
all later modules.

### Patch 2 — Motorcycles and mechanic profiles

- Status: Completed. Patches 1-5 are complete through T068 plus T112-T113.
  Patch 5 was explicitly authorized by the user and completed through T068.
  feature 005 payment is implemented separately.
- Motorcycle ownership CRUD.
- Mechanic `profile_status`, merged MVP availability state, broad skills,
  service radius, latest location, availability timestamps, and read-only
  rating aggregates defaulting to zero.
- Store `latest_location` and `location_updated_at` directly on the mechanic
  profile; do not introduce a separate mechanic-location table or repository.
- Persist backend-controlled location timestamps and prepare for the
  `location_max_age_seconds = 300` dispatch eligibility rule.
- Active workload is derived from active assignments; no review module or
  mechanic-editable rating/job counter is introduced.
- Ownership/RBAC and repository integration tests.

### Patch 3 — Service requests and state machine

- Status: Completed. T034-T043 are complete.
- Request create/list/read/cancel.
- Category-light service types:
  `emergency_rescue`, `mobile_repair`, `at_home_service`,
  `periodic_maintenance`, and `other`.
- `COR-{SERVICE_PREFIX}-{YYYYMMDD}-{DAILY_SEQUENCE}` request-code generation
  using the Asia/Ho_Chi_Minh date and collision-safe monotonic allocation.
- Require `X-Idempotency-Key` for every service-request creation.
- Status history, idempotency, outbox, and audit.
- `fulfillment_mode = immediate_location | scheduled_visit` for `other`, with
  strict location/schedule combinations and no implicit emergency dispatch.
- Patch 3 periodic maintenance requires a future schedule. It does not store or
  validate reminder-origin references.
- Location/schedule/fulfillment validation and transition tests.
- Enforce the service-type input matrix and ownership-safe request media
  metadata behavior.

### Patch 4 — Dispatch and assignments

- Status: Completed through T059.
- Migrations `202606250008_dispatch_candidates.sql` and
  `202606250009_assignments.sql` passed isolated PostgreSQL schema tests.
  Isolated-schema tests do not prove deployment to the hosted/dev application
  schema.
- Before enabling Patch 4 APIs against hosted/dev application data, migrations
  008 and 009 must be applied and verified there in order.
- Candidate query and bounded rounds.
- Apply the deterministic dispatch constants, ordering, active-job conflict
  states, offer expiry, round limit, and total wait limit.
- Persisted `DispatchCandidate` offer lifecycle.
- Atomic accept/decline.
- Active assignment constraints and concurrency tests.
- Rider-cancel versus mechanic-accept races lock and re-check the same request;
  both commit orders are tested with no inconsistent history/audit/outbox.
- Manual escalation.

### Patch 5 — Mechanic diagnosis and quotes

- Status: Explicitly authorized by the user and completed through T068.
- Migration `202606250010_diagnoses_and_quotes.sql` passed isolated PostgreSQL
  schema tests. Isolated-schema tests do not prove deployment to the hosted/dev
  application schema.
- Before enabling Patch 5 APIs against hosted/dev application data, migrations
  008, 009, and 010 must be applied and verified there in order.
- Text-first mechanic diagnosis.
- At most one current diagnosis per assignment; assigned-mechanic/admin
  create/revise only in `on_site` or `diagnosis`.
- Diagnosis revision locks and re-checks assignment and diagnosis. Once a quote
  references the diagnosis, it is immutable; post-quote correction requires a
  separately specified future diagnosis-version workflow.
- Diagnosis audit/outbox payloads remain sanitized and omit full diagnosis text.
- Immutable quote lines/versions.
- Server-side totals.
- First quote creation moves assignment `diagnosis -> quoted` and request
  `in_service -> awaiting_quote_approval`; later versions keep those states.
- Latest-version approval moves assignment/request to `awaiting_payment` without
  creating payment or starting work. Rejection keeps assignment `quoted` and
  request `awaiting_quote_approval` so a newer version may be created.
- Latest-version approval/rejection, synchronized-state, and stale-write tests.
- Patch 5 does not add assigned-state cancellation.

### Patch 6 / Feature 005 — Payments

- Status: Implemented as feature 005 backend-only payOS/VietQR payment orders.
- Migration `202606250020_payments.sql` follows
  `202606250019_assignment_completion_checklists.sql`.
- Provider-neutral boundary with mocked automated tests and a payOS runtime
  adapter.
- Idempotent rider payment order creation.
- Closed payment-order statuses are `created`, `pending`, `succeeded`, `failed`,
  `canceled`, and `needs_review`.
- Normative transitions are:
  - `created -> pending | canceled`;
  - `pending -> succeeded | failed | canceled | needs_review`;
  - `failed -> pending | canceled`, with retry only through an explicit backend
    payment-order retry action accepted by the mock/sandbox adapter.
  `needs_review` is terminal for automated processing; `succeeded` and
  `canceled` are terminal.
- Verified provider-webhook adapter boundary. Browser/client callbacks are
  never authoritative and cannot mark payment successful.
- A verified event resolving to a known order with matching provider/order
  identity but mismatched amount or currency transitions that order to
  unresolved `needs_review`, writes sanitized audit/outbox records atomically,
  and cannot advance the service workflow.
- A verified unmatched provider reference updates no payment order or service
  workflow. It may create only a sanitized unmatched provider-event/audit record
  when supported; otherwise it returns a controlled non-success/no-domain-update
  result.
- Only a verified matching webhook may transition `pending -> succeeded`.
  Duplicate verified events are idempotent replay with no additional
  transition. Succeeded payment is a prerequisite for, but does not bypass, the
  authorized assignment `awaiting_payment -> in_progress` action.
- No real credentials in code/docs, no checkout UI, no settlement, no
  client-authoritative success, and no refund workflow.

### Patch 7 — Reminders, notifications, and workers

- Status: Patch 7A reminder rules, occurrences, service-request integration,
  and worker behavior are completed through T087. Patch 7B notification
  persistence, outbox delivery, and audit hardening are completed through
  T096.
- Date/time-based, not odometer-based reminder rules and occurrences.
- Add service-request reminder references and the reminder-originated
  periodic-maintenance workflow after reminder ownership and due-state tables
  exist.
- Patch 7A includes reminder rules, occurrences, reminder-originated
  service-request integration, and the protected reminder worker route.
- Patch 7B owns notification persistence, outbox delivery workers,
  retry/dead-letter behavior, and delivery-status audit.

### Patch 8 — Existing chatbot persistence integration

- Status: Explicitly authorized and completed through T105.
- Add a repository-backed implementation for existing chatbot sessions,
  messages, and diagnosis results.
- Preserve all `/api/chatbot/**` request and response contracts.
- Keep the in-memory session-store and rate-limiter implementations available
  for local and focused tests.
- Add restart-persistence and chatbot safety/provider/fallback regression tests.
- Do not store raw audio or provider secrets.
- Preserve local retrieval, Zod validation, post-validation, provider order,
  rate limits, and structured-log redaction.

### Patch 9 — Hardening and operational validation

- Status: Explicitly authorized and completed through T118 (T106-T111 and
  T114-T118). Feature 005 payment is implemented separately.
- Full RLS review.
- Migration reset/upgrade tests.
- Pagination and retention indexes.
- Small deterministic performance smoke checks with generous local regression
  thresholds for auth/CRUD, dispatch/assignment, non-blocking workers, and
  chatbot latency; these are not production p95 or capacity claims.
- Audit sanitization review.
- Committed-file/fixture secret scan, `/api/v1` response and audit/outbox
  privacy checks, and frontend-bundle server-variable exposure checks.
- Full regression suite including existing chatbot/ASR.

## Existing Files and Areas That Should Remain Unchanged

The following should not be modified during normal implementation:

```text
app/page.tsx
app/globals.css
app/api/chatbot/**                # Route contracts remain unchanged
src/features/asr/**
scripts/asr-smoke.mjs
models/**
specs/001-careonroad-chatbot-mvp/**
```

Existing chatbot, provider, ASR, route, schema, retrieval, post-validation,
rate-limit, logger, and view-model tests remain unchanged and continue to run.

Files that may receive narrow additive changes only:

```text
package.json                       # Approved backend dependencies/scripts
package-lock.json                  # Generated dependency lock changes
.env.example                       # Empty server-only configuration names
src/lib/api-error.ts               # Add stable v1 backend error codes/helpers
src/lib/server-logger.ts           # Add sanitization keys/events if required
next.config.ts                     # Only if server package externalization requires it
AGENTS.md                          # Managed Spec Kit plan reference
src/features/chatbot/session.store.ts
src/features/chatbot/diagnosis.service.ts
src/features/chatbot/api-routes.ts # Persistence integration only; preserve contracts
```

No existing chatbot provider, safety gate, fallback, prompt, post-validation,
ASR, route contract, or UI behavior is part of feature 002 rewrite scope.
Chatbot code changes are limited to repository-backed persistence integration
for sessions, messages, and diagnosis results.

## Completed Foundation Patch

**Name**: `backend foundation: auth, transactions, repositories, outbox, audit`

**Status**: Completed. Patches 1-5 are complete through T068 plus T112-T113.
Feature 005 payment is implemented separately. Patch 7A is completed through
T087, and Patch 7B notification persistence, outbox delivery, and audit
hardening are completed through T096. Patch 8 compatible chatbot persistence
is completed through T105. Patch 9 hardening and operational validation is
completed through T118 (T106-T111 and T114-T118).

Expected files:

```text
app/api/v1/auth/me/route.ts
app/api/v1/auth/profile/route.ts
app/api/v1/auth/devices/route.ts
src/features/auth/**
src/server/auth/**
src/server/db/**
src/server/repositories/contracts/**
src/server/repositories/postgres/postgres-unit-of-work.ts
src/server/repositories/postgres/user.repository.ts
src/server/repositories/postgres/idempotency.repository.ts
src/server/repositories/postgres/outbox.repository.ts
src/server/repositories/postgres/audit.repository.ts
supabase/migrations/202606250001_enable_extensions.sql
supabase/migrations/202606250002_outbox_audit_idempotency.sql
supabase/migrations/202606250003_rls_foundation.sql
supabase/migrations/202606250004_identity_and_roles.sql
supabase/migrations/202606250005_user_devices.sql
```

Acceptance for the first patch:

- Valid JWT returns current actor/profile.
- Invalid JWT returns controlled `401`.
- Profile bootstrap is idempotent.
- Profile bootstrap and user-device registration write sanitized audit/outbox
  rows atomically.
- User roles are database-owned.
- One transaction can commit profile/outbox/audit/idempotency together.
- Repository interfaces have in-memory test doubles.
- Migration static/unit checks pass locally; isolated hosted apply/rollback and
  unit-of-work atomicity checks pass through the Supabase session pooler.
- No existing chatbot/ASR file needs modification.
- Existing test suite plus new auth/repository tests pass.

## Post-Design Constitution Check

- AI principles and tests: **PASS**; preserved without redesign.
- Backend and secret ownership: **PASS**; new credentials are server-only.
- Database safety and concurrency: **PASS**; explicit transactions, locks,
  constraints, and idempotency are designed.
- Backend workflow scope: **PASS**; authorized by constitution 1.1.0.
- Excluded frontend, production settlement/refund, tracking UI, and AI-autonomy
  scope: **PASS**.

No governance, design, or foundation database gate blocker remains.

## Complexity Tracking

No constitution violations require justification. Repository/unit-of-work,
transactional outbox, and PostGIS choices are documented design decisions for
transaction safety, reliable asynchronous delivery, and indexed dispatch
queries.
