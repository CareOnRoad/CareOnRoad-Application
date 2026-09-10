# Research: CareOnRoad Backend MVP

## Decision: Current repository behavior is authoritative for the completed baseline

**Rationale**: `CareOnRoad_supabase_backend_updated.md` contains both a
current-state description and collapsed legacy design material. Existing
chatbot/ASR behavior is derived from the current-state section and repository
code. Legacy material is used only for future backend concepts that do not
conflict with the completed baseline.

**Alternatives considered**:

- Treat all legacy design as already implemented: rejected because it
  contradicts the current repository.

## Decision: Extend the existing Next.js modular monolith

**Rationale**: The repository already has thin App Router handlers and
feature-owned services. Adding `/api/v1` routes and new `src/features/*`
modules preserves one deployment, shared validation/logging conventions, and
the completed chatbot/ASR behavior.

**Alternatives considered**:

- Separate backend project: rejected by the requested scope and would duplicate
  configuration, types, and operational concerns.
- Put all behavior in route handlers: rejected because transactions and state
  rules need testable application services.

## Decision: Supabase Auth JWT verification in backend middleware

**Rationale**: Supabase access tokens contain the authenticated subject and can
be verified against the project JWKS when asymmetric signing keys are enabled.
The backend then loads application roles from PostgreSQL rather than trusting a
client-supplied role. Verification checks issuer, audience when configured,
expiry, not-before, algorithm, and signature.

**Alternatives considered**:

- Trust decoded JWT claims without signature verification: rejected.
- Use the Supabase service-role key as user identity: rejected because it is a
  privileged backend credential, not a user credential.
- Verify every token through the Auth server: retained only as a controlled
  fallback for legacy shared-secret projects because it adds network latency.

Reference: [Supabase JWT documentation](https://supabase.com/docs/guides/auth/jwts)

## Decision: Direct PostgreSQL access for business transactions

**Rationale**: Dispatch acceptance, quote versioning, payment events, reminder
claims, outbox claims, and audit writes require multi-statement transactions,
row locks, and database constraints. A backend PostgreSQL client supports these
directly. Migrations use the direct connection; application traffic uses direct
or session-pooler mode for a persistent server and transaction-pooler mode only
when the runtime is short-lived and client behavior is compatible.

**Alternatives considered**:

- Supabase Data API for all writes: rejected for contested multi-table
  transactions unless every workflow is hidden behind database RPC functions.
- ORM-first design: deferred. Repository interfaces plus typed SQL keep the
  first patch smaller and make locking behavior explicit.

Reference:
[Supabase database connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)

## Decision: `postgres` and `jose` as proposed backend dependencies

**Rationale**: `postgres` provides a small TypeScript-friendly transaction API
for PostgreSQL. `jose` supports remote JWKS verification and standard claim
validation. Both remain server-only.

**Alternatives considered**:

- `pg`: valid, but requires more manual transaction/client lifecycle code.
- `@supabase/supabase-js` alone: useful for Auth/Data API access but does not
  replace direct transactional SQL for the selected workflows.

Dependency installation requires explicit approval during implementation.

## Decision: Repository interfaces plus transaction-scoped unit of work

**Rationale**: Feature services need storage-independent contracts for unit
tests, while contested workflows need multiple repositories to share one
transaction. A `UnitOfWork` creates transaction-scoped repositories and commits
domain changes, outbox events, idempotency records, and audit rows together.

**Alternatives considered**:

- One global database helper used directly by every feature: rejected because
  transaction boundaries and test doubles become implicit.
- Repository per table with no unit of work: rejected because cross-table
  atomicity would leak into route handlers.

## Decision: Database-enforced concurrency invariants

**Rationale**: Assignment acceptance locks the service request/offer rows and
uses partial unique indexes for one active assignment per request and the
configured mechanic active-work policy. Quote version allocation locks the
request's quote stream. Worker claims use `FOR UPDATE SKIP LOCKED`.

**Alternatives considered**:

- Application-only pre-checks: rejected because concurrent requests can pass
  the same check before either commits.
- Distributed locks: unnecessary while PostgreSQL is the system of record.

References:

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

## Decision: PostGIS for dispatch distance, no route provider in v1

**Rationale**: Latest mechanic and request coordinates can be stored as
`geography(Point, 4326)`. `ST_DWithin` filters service radius and distance sorts
candidate ranking. External travel-time routing is deferred, avoiding a new
provider while preserving a clear adapter point.

**Alternatives considered**:

- Plain latitude/longitude with application math: possible but weaker for
  indexed radius queries.
- Google/Mapbox routing in the first patch: deferred because dispatch
  correctness does not require ETA integration.

## Decision: Explicit state machines with append-only history

**Rationale**: Service requests, assignments, quotes, payments, outbox events,
and reminder occurrences have controlled transitions. Services validate
transitions, database checks constrain legal values, and history tables retain
who changed what and when.

**Alternatives considered**:

- Free-form status strings: rejected because illegal transitions become hard to
  detect.
- Event sourcing: rejected as excessive for the MVP.

## Decision: Versioned immutable quotes

**Rationale**: Quote lines and calculated totals are immutable after creation.
Replacing a quote creates a new version. Only the latest pending version can be
approved or rejected, preventing stale rider decisions.

**Alternatives considered**:

- Update quote rows in place: rejected because it destroys the approval trail.

## Decision: Generic payment adapter and idempotent webhook core

**Rationale**: The backend defines provider-neutral payment order and event
interfaces. Provider-specific signing and payload parsing stay in adapters.
Logical processing deduplicates `(provider, provider_event_id)` and verifies
order identity, amount, and currency before transition. Feature 002 uses only
mock/sandbox adapters and webhook fixtures. Client callbacks are never payment
authority; only verified webhook processing may mark an order succeeded.

**Alternatives considered**:

- Select and couple to one provider during planning: deferred because no
  provider was requested.
- Trust redirect/browser success state: rejected; provider callbacks are the
  payment authority.
- Real checkout, settlement, and refunds: excluded from feature 002.

## Decision: Backend-generated request codes with scoped daily sequences

**Rationale**: Public request codes use
`COR-{SERVICE_PREFIX}-{YYYYMMDD}-{DAILY_SEQUENCE}` for support and search while
UUID remains the internal identifier. The local date is calculated in
`Asia/Ho_Chi_Minh`; sequence allocation is monotonic per prefix/date and retries
after a unique conflict.

**Alternatives considered**:

- Expose UUID as the only support identifier: rejected because it is difficult
  to communicate.
- Generate codes in clients: rejected because uniqueness and local-date
  sequencing require one backend authority.

## Decision: Date-based reminder rules and deduplicated occurrences

**Rationale**: The first reminder module uses `next_due_at`, recurrence interval,
snooze, and enabled state. A unique occurrence key prevents duplicate delivery
when workers overlap or retry.

**Alternatives considered**:

- Odometer/model-specific maintenance schedules: deferred because current scope
  is time-based and text-first.

## Decision: Transactional outbox with leased workers

**Rationale**: Domain changes write outbox rows in the same transaction. Workers
claim rows with a lease, process adapters, and record retry/backoff or
dead-letter status. Consumers must use stable deduplication keys because a
worker can fail after external delivery but before marking success.

**Alternatives considered**:

- Send notifications inside request transactions: rejected because external
  latency and failure would hold locks or roll back domain work.
- Fire-and-forget after commit: rejected because process failure can lose events.

## Decision: Append-only sanitized audit log

**Rationale**: Important mutations record actor, action, entity, request id,
timestamp, and safe metadata. Audit payloads reuse the project's sanitization
rules and prohibit secrets, raw audio, full chatbot text, tokens, phone/email,
and payment credentials.

**Alternatives considered**:

- Store full request/response bodies: rejected for privacy and secret leakage.

## Decision: RLS as defense in depth, backend authorization as authority

**Rationale**: New domain tables enable RLS and deny direct client writes by
default. The backend verifies identity, role, ownership, and state on every
endpoint. Privileged database credentials never reach the frontend.

**Alternatives considered**:

- RLS-only business authorization: rejected because complex workflow and state
  rules belong in backend services and database constraints.
- Disable RLS because routes are backend-only: rejected because accidental Data
  API exposure would have no secondary control.

## Decision: Add chatbot persistence through a compatible repository adapter

**Rationale**: Feature 002 may persist existing chatbot sessions, messages, and
diagnosis results in PostgreSQL while preserving current route contracts,
provider chain, safety gate, fallback, post-validation, local ASR, and UI
behavior. The in-memory implementation remains available for focused tests and
local fallback. Persistence integration is isolated behind the session-store
contract and is not a chatbot rewrite.

**Alternatives considered**:

- Keep chatbot data permanently in memory: rejected because feature 002 now
  explicitly includes persistence integration.
- Rewrite chatbot services around database entities: rejected because it risks
  completed safety and demo behavior.

## Decision: Versioned migrations under `supabase/migrations`

**Rationale**: SQL migrations are reviewable and reproducible across local and
hosted Supabase environments. Manual Dashboard-only schema changes are not
authoritative.

**Alternatives considered**:

- Unversioned SQL notes: rejected.
- Runtime schema creation: rejected.

References:

- [Supabase local development](https://supabase.com/docs/guides/local-development/overview)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)

## Resolved Clarifications

- Auth provider: Supabase Auth.
- Application roles: rider, mechanic, admin.
- Database: Supabase-managed PostgreSQL with PostGIS.
- Persistence access: backend direct SQL behind repositories.
- Payment provider: provider-neutral adapter in this feature.
- Reminder basis: date/time only.
- Notification delivery: in-app persistence plus outbox; external adapters later.
- Existing chatbot storage: repository-backed persistence with compatible
  in-memory test implementation.
- Service-request replay protection: `X-Idempotency-Key` scoped by actor and
  endpoint, with payload-hash mismatch rejection.
- New runtime: Node.js route handlers.
- Constitutional status: implementation blocked until scope amendment.
