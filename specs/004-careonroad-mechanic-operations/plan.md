# Implementation Plan: CareOnRoad Mechanic Operations

**Branch**: `004-careonroad-mechanic-operations` | **Date**: 2026-07-07 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from
`/specs/004-careonroad-mechanic-operations/spec.md`

## Summary

Add backend-only mechanic operational APIs for dashboard, job list,
performance, ETA or delay updates, field media metadata, and completion
checklist metadata. The feature is mechanic-owned runtime workflow and is
separate from the admin-owned operations feature in
`specs/003-careonroad-admin-operations/`.

The feature reuses existing Next.js route-handler conventions, Supabase JWT
actor loading, role checks, repository/unit-of-work patterns, assignment state
rules, audit/outbox sanitization, and existing dispatch/assignment/quote data.
Dashboard and performance views are derived read models, not persisted
analytics tables.

No frontend UI, mobile UI, payment checkout, payment provider, settlement,
inventory, live tracking UI, Maps UI, odometer reminder, chatbot, or ASR change
is included.

## Technical Context

**Language/Version**: TypeScript on Node.js through the existing Next.js App
Router backend.

**Primary Dependencies**:

- Existing App Router route handlers under `app/api/v1/**`.
- Existing Zod validation, Vitest tests, repository contracts, PostgreSQL
  adapters, in-memory testing adapters, transaction/unit-of-work helpers, audit,
  outbox, and Supabase JWT actor helpers.
- No new runtime dependency is planned.

**Storage**: Existing Supabase-managed PostgreSQL. Additive migrations are
planned only for durable mechanic-authored metadata:

- assignment ETA/progress metadata;
- mechanic assignment media metadata;
- completion checklist/work summary records.

Dashboard, job list, and performance data are derived from existing domain rows
and those new metadata tables where relevant. No dashboard or performance table
is introduced.

**Testing**:

- Vitest route and service tests with fake authenticated actors.
- Repository contract tests for new metadata and mechanic-owned read models.
- PostgreSQL integration tests for migrations, constraints, ownership,
  transaction rollback, and audit/outbox metadata.
- Static scope tests proving no frontend, payment, Maps/live tracking,
  inventory, odometer reminder, chatbot, or ASR implementation is introduced.
- Full regression: `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build`.

**Target Platform**: Existing Next.js server runtime and existing PostgreSQL
backend. No browser or mobile mechanic UI is included.

**Project Type**: Existing full-stack repository receiving backend-only mechanic
API additions.

**Performance Goals**:

- Bounded dashboard and performance read models complete within two seconds for
  the MVP operational dataset after warm-up.
- Performance smoke tests execute dashboard, jobs, and performance read models
  after five warm-up calls and require at least 19 of 20 measured calls per read
  model to complete within two seconds.
- Job list pages are capped at 100 rows and use stable cursor pagination.
- New metadata mutations complete in a single transaction and do not perform
  raw media processing.

**Constraints**:

- Mechanic-owned scope only; routes are under existing mechanic or assignment
  API paths, not `/api/v1/admin`.
- Mutations must verify the current actor is the assigned mechanic and must
  lock/re-check contested assignment state.
- Mechanic metadata mutations require `X-Idempotency-Key`; replay with the same
  request body returns the original successful result, while replay with a
  different body is rejected as a conflict.
- Audit/outbox entries are sanitized and metadata-first.
- Existing dispatch, assignment, diagnosis, quote, reminder, notification,
  outbox, chatbot, ASR, admin, and rider behavior must not change.
- Payment is owned by feature 005; this mechanic operations feature adds no
  payment route, provider, settlement, or earnings/payout dashboard.

## Research Basis

- [Urgently](https://www.geturgently.com/) documents roadside service-provider
  operations including real-time service acceptance, technician mobile app
  status updates, location tracking, dashboards, customer satisfaction, and
  performance metrics. CareOnRoad adopts service-provider operational concepts
  while excluding live tracking UI and Maps UI from this feature.
- [Uber Driver app](https://www.uber.com/us/en/drive/driver-app/) documents a
  provider home surface, online/offline operation, trip requests, navigation,
  contact, earnings, activity, and settings. CareOnRoad adopts the operational
  dashboard/job model while excluding earnings, payout, and frontend work.
- [Housecall Pro mobile app](https://www.housecallpro.com/features/mobile-app/)
  documents field-service job dashboards, schedules, job details, customer
  history, estimates, invoices, offline access, and time tracking. CareOnRoad
  adopts backend job-detail, field-proof, and work-summary patterns while
  excluding invoices, payments, and app UI.

## Constitution Check

*GATE: Passed before design; must be re-checked before implementation.*

- Advisory AI output: **PASS**. No chatbot or AI output is changed.
- Backend-controlled AI safety: **PASS**. Safety gate, retrieval, Gemini and
  OpenRouter behavior, fallback, ASR, and logging remain unchanged.
- Secret isolation: **PASS**. New DTOs and metadata are allowlisted and must not
  expose credentials, raw media, raw audio, or provider payloads.
- Vietnamese-first chatbot: **PASS**. Chatbot behavior is untouched.
- Validated JSON and fallback: **PASS**. Provider validation and fallback are
  untouched.
- Backend workflow scope: **PASS**. Work is limited to authenticated mechanic
  backend routes, repositories, migrations, audit/outbox, and read models.
- Excluded scope: **PASS**. No frontend, payment, settlement, inventory,
  odometer reminder, tracking UI, Maps UI, chatbot, or ASR rewrite.
- Workflow integrity: **PASS**. Mutations use actor ownership, transactions,
  state re-checks, assignment invariants, sanitized audit, and outbox events.
- Required tests: **PASS BY DESIGN**. Authorization, ownership, validation,
  state, rollback, audit/outbox, migration, static scope, and regression tests
  are explicit in [tasks.md](tasks.md).

## Public API Additions

### `GET /api/v1/mechanics/me/dashboard`

Read-only mechanic home summary.

Returns:

- mechanic availability and profile status summary;
- location freshness based on existing dispatch freshness policy;
- open offers count;
- active assignment summary when present;
- today counts;
- seven-day performance summary;
- rating average/count;
- next action codes such as `go_available`, `update_location`,
  `review_offer`, `continue_active_job`, `no_action`.

### `GET /api/v1/mechanics/me/jobs`

Mechanic-focused assignment/job list.

Filters:

- `status`
- `active_only`
- `date_from`
- `date_to`
- `limit`
- `cursor`

Returns mechanic-owned assignment summaries plus safe service-request context.
Full rider narrative, private notes, raw media, and admin-only data are not
returned.

### `GET /api/v1/mechanics/me/performance`

Read-only mechanic metrics.

Returns:

- completed jobs;
- canceled jobs;
- acceptance rate;
- decline rate;
- average accept time;
- average workflow durations;
- quote approval rate;
- rating average/count.

No earnings, payout, settlement, or payment metric is returned.

### `POST /api/v1/assignments/[assignmentId]/eta`

Assigned mechanic updates ETA or delay reason for an active assignment.

Behavior:

- verifies active mechanic and assignment ownership;
- rejects terminal or non-active states;
- validates ETA from one minute to 24 hours in the future and bounded delay
  reason;
- requires `X-Idempotency-Key` and prevents duplicate ETA metadata, audit, or
  outbox records on replay;
- writes metadata only;
- appends sanitized audit/outbox metadata;
- does not introduce live tracking UI.

### `POST /api/v1/assignments/[assignmentId]/media`

Assigned mechanic adds field media metadata for diagnosis or work proof.

Behavior:

- stores metadata references only;
- rejects raw files, raw base64, provider payloads, and secret-like data;
- validates purpose, content type, size, and reference;
- requires `X-Idempotency-Key` and prevents duplicate media metadata, audit, or
  outbox records on replay;
- appends sanitized audit/outbox metadata;
- does not store raw media in audit or outbox.

### `POST /api/v1/assignments/[assignmentId]/completion-checklist`

Assigned mechanic submits work summary and safety checklist before completing
eligible work.

Behavior:

- verifies assignment ownership and eligible active state: `accepted`,
  `en_route`, `on_site`, `diagnosis`, `quoted`, `awaiting_payment`, or
  `in_progress`;
- stores append-only checklist revisions; the latest revision for an assignment
  is effective;
- validates required work summary and safety checklist fields;
- requires `X-Idempotency-Key` and prevents duplicate checklist revisions, audit,
  or outbox records on replay;
- does not bypass existing assignment state machine;
- does not require completion gating unless a later spec explicitly authorizes
  that behavior.

## Architecture Decisions

### Route and service boundary

- Add thin App Router adapters under:
  - `app/api/v1/mechanics/me/dashboard/route.ts`
  - `app/api/v1/mechanics/me/jobs/route.ts`
  - `app/api/v1/mechanics/me/performance/route.ts`
  - `app/api/v1/assignments/[assignmentId]/eta/route.ts`
  - `app/api/v1/assignments/[assignmentId]/media/route.ts`
  - `app/api/v1/assignments/[assignmentId]/completion-checklist/route.ts`
- Put orchestration in `src/features/mechanic-operations/`.
- Keep route files thin, matching existing `src/features/*/*.route-handlers.ts`
  patterns.

### Authorization

- Reuse existing authenticated actor loading and role checks.
- Add a mechanic-operation helper that requires an active mechanic actor and
  uses backend profile identity, not client-submitted mechanic IDs.
- Assignment mutations verify the assignment is owned by the current mechanic
  inside the transaction before writing.

### Read model strategy

- Dashboard, job list, and performance are derived from existing mechanic
  profile, dispatch candidate/offer, assignment, assignment history, quote, and
  rating rows.
- Add repository methods only where existing contracts cannot support bounded
  mechanic-owned read models.
- Do not add persisted dashboard or performance tables.

### Metadata persistence

- Add new durable tables only for:
  - assignment ETA/progress metadata;
  - mechanic assignment media metadata;
  - completion checklist/work summary records.
- Use append-only records where overwriting would hide operational history.
- Completion checklists use append-only revisions; idempotent replay returns the
  original revision and does not create a new revision.
- Store metadata references only for media; raw media storage is outside scope.

### Audit, outbox, and privacy

- Successful mechanic-authored metadata mutations append sanitized audit and
  outbox records when operationally meaningful.
- Audit/outbox metadata contains IDs, codes, timestamps, safe counts, ETA
  timestamps, and bounded safe strings only.
- Never copy raw media, raw audio, raw provider payloads, payment-sensitive
  content, admin notes, rider private narrative, or unrestricted full text into
  responses, audit, outbox, logs, or fixtures.

### Existing behavior preservation

- Existing dispatch offer lifecycle and mechanic acceptance remain unchanged.
- Existing assignment status transitions remain the source of truth.
- Existing mechanic diagnosis and quote workflows remain unchanged.
- Existing reminder, notification, outbox worker, chatbot persistence, ASR, and
  frontend behavior remain unchanged.

## Project Structure

### Documentation

```text
specs/004-careonroad-mechanic-operations/
|-- spec.md
|-- plan.md
`-- tasks.md
```

### Source Code

```text
app/
`-- api/v1/
    |-- mechanics/me/
    |   |-- dashboard/route.ts
    |   |-- jobs/route.ts
    |   `-- performance/route.ts
    `-- assignments/[assignmentId]/
        |-- eta/route.ts
        |-- media/route.ts
        `-- completion-checklist/route.ts

src/
|-- features/mechanic-operations/
|   |-- mechanic-operations.schemas.ts
|   |-- mechanic-operations.authorization.ts
|   |-- mechanic-operations.route-handlers.ts
|   |-- mechanic-dashboard.service.ts
|   |-- mechanic-job-list.service.ts
|   |-- mechanic-performance.service.ts
|   |-- mechanic-assignment-metadata.service.ts
|   `-- __tests__/
`-- server/repositories/
    |-- contracts/
    |-- postgres/
    `-- testing/
```

**Structure Decision**: Extend the existing modular monolith. Mechanic
operation services own authorization and orchestration while existing domain
services, assignment state helpers, repository contracts, and database
constraints remain the source of truth.

## Implemented Migrations

The current workspace implements the mechanic-operation migrations as concrete
timestamped files after the admin-operation migrations.

| Migration purpose | Additive change |
|---|---|
| `202606250017_assignment_eta_metadata.sql` | Add assignment ETA/progress metadata with assignment/mechanic references, ETA timestamp, optional bounded delay reason, provenance, indexes, constraints, and RLS/direct-write protections. |
| `202606250018_assignment_media_metadata.sql` | Add assignment media metadata references with purpose, content type, size, storage/reference key, mechanic provenance, indexes, constraints, and no raw media columns. |
| `202606250019_assignment_completion_checklists.sql` | Add append-only checklist records with work summary, structured safety checks, mechanic provenance, assignment reference, indexes, constraints, and RLS/direct-write protections. |

No migration is reserved for payment, frontend, Maps, live tracking UI,
inventory, odometer reminders, chatbot, or ASR changes.

## Test and Verification Strategy

Every story follows tests-first task ordering and includes:

1. Route authorization matrix: missing auth 401, invalid token 401, inactive or
   non-mechanic 403, active mechanic success.
2. Object ownership tests proving no cross-mechanic leakage.
3. Schema validation tests for query filters, pagination, ETA bounds, delay
   reason bounds, media metadata, work summary, and checklist values.
4. Service tests for empty states, valid states, invalid states, stale state,
   rollback, sanitized audit, and outbox.
5. Idempotency tests for missing keys, successful replay, conflict replay, and
   no duplicate metadata, audit, or outbox writes.
6. Repository tests for bounded read models, metadata writes, constraints,
   cursor pagination, and transaction behavior.
7. Static scope tests proving no frontend UI, payment, Maps/live tracking UI,
   inventory, odometer reminder, chatbot, or ASR artifacts.
8. Performance smoke tests for dashboard, jobs, and performance read models.
9. Full regression with `npm.cmd test`, `npm.cmd run typecheck`,
   `npm.cmd run lint`, and `npm.cmd run build`.

## Operational Rollout

- Read-only dashboard, jobs, and performance can run after repository methods are
  deployed.
- ETA, media metadata, and completion checklist routes are implemented, but they
  require migrations `017` through `019` to be applied before enabling them
  against hosted/dev.
- Hosted/dev migration state must be inspected with
  `npx.cmd supabase migration list` and previewed with
  `npx.cmd supabase db push --dry-run` before applying new migrations.
- Migration task names must be resolved to concrete timestamped filenames before
  implementation begins.
- No mock-data seed may target production.
- Rollout does not require frontend changes; validation is through backend
  route tests and API clients.

## Complexity Tracking

No constitution violation requires justification. New persistence is limited to
mechanic-authored assignment metadata that cannot be derived from existing
history. Dashboard and performance are derived read models.
