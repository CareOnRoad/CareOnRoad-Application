# Research: CareOnRoad Admin Operations

## Decision 1 - Extend the modular monolith

**Decision**: Add `/api/v1/admin` adapters and `src/features/admin` services
inside the existing application.

**Rationale**: Existing authentication, UnitOfWork, repositories, audit, outbox,
error mapping, and tests already establish the required boundaries. A separate
admin backend would duplicate security-critical logic.

**Alternatives considered**:

- Separate admin service: rejected because it duplicates domain state machines
  and transaction boundaries.
- Direct database administration: rejected because it bypasses authorization,
  audit, outbox, and stable errors.

## Decision 2 - One active admin role, no admin sub-roles

**Decision**: Require the existing active `admin` role for every new operation.

**Rationale**: The feature scope explicitly uses one admin role. Additional
support, dispatcher, finance, or super-admin roles would expand policy and UI
scope.

**Alternatives considered**:

- Fine-grained admin roles: valuable later but out of scope.
- Route-name-only protection: rejected because authorization must be enforced by
  the service layer.

## Decision 3 - Shared command envelope and idempotency

**Decision**: Every admin mutation requires a 10-500 character reason and
`X-Idempotency-Key`, then uses the existing idempotency lifecycle with a
command-specific scope.

**Rationale**: Admin commands are retry-prone operational actions. A shared
envelope makes reason, replay, conflict, audit, and error behavior consistent.

**Alternatives considered**:

- Reason only: rejected because repeated network requests could duplicate
  downstream work.
- Idempotency only for selected commands: rejected because it creates an
  inconsistent administrative contract.

## Decision 4 - Serialize last-admin mutations with a transaction advisory lock

**Decision**: Account-status and role-removal commands acquire one fixed
transaction advisory lock, then lock and re-count active admins before mutation.

**Rationale**: Locking only the target user cannot prevent two administrators
from concurrently removing each other. A shared lock serializes the invariant
without a new persistent lock table.

**Alternatives considered**:

- Pre-count without lock: rejected due to race condition.
- Singleton guard table: valid but adds a row used only as a mutex.
- Database trigger: rejected because it obscures service-level stable error
  mapping and reason/audit coordination.

## Decision 5 - Cursor pagination and bounded filters

**Decision**: Use opaque cursors backed by deterministic timestamp-plus-UUID
ordering, default page size 50, maximum 100, and maximum audit export 10,000.

**Rationale**: Admin data is append-heavy. Cursor pagination remains stable when
new audit/outbox rows arrive and prevents unbounded reads.

**Alternatives considered**:

- Offset pagination: simpler but unstable and increasingly expensive.
- Unbounded export: rejected for privacy and operational safety.

## Decision 6 - Dedicated audit reason column

**Decision**: Add nullable `admin_reason` to append-only `audit_logs`; require it
for admin mutations.

**Rationale**: Existing metadata sanitizer intentionally rejects arbitrary text.
A dedicated constrained column provides required human-readable accountability
without weakening metadata redaction.

**Alternatives considered**:

- Add reason to metadata allowlist: rejected because free text could contain
  sensitive content and weaken generic sanitization.
- Separate admin-action table for every command: rejected as duplicate audit
  storage.

## Decision 7 - Store internal notes separately

**Decision**: Add one append-only `admin_internal_notes` table with exactly one
request or assignment target.

**Rationale**: Notes are private narrative content, must not enter audit/outbox,
and need real foreign-key integrity.

**Alternatives considered**:

- Store notes in audit metadata: rejected by privacy rules.
- Generic entity type/id only: rejected because it loses foreign-key integrity.
- Add note columns to request/assignment: rejected because notes are
  append-only history, not mutable entity fields.

## Decision 8 - Mechanic rejection is a distinct durable outcome

**Decision**: Add `rejected` to mechanic profile status. Approval is pending to
active; rejection is pending to rejected; reactivation applies to suspended,
not banned.

**Rationale**: Reusing suspended for an onboarding rejection makes operational
history ambiguous.

**Alternatives considered**:

- Map rejected to suspended: rejected due to semantic ambiguity.
- Delete rejected profile: prohibited by no-hard-delete.

## Decision 9 - Manual assignment has first-class provenance

**Decision**: Add assignment source, assigning admin, and optional superseded
assignment. Offer acceptance keeps its accepted candidate; admin manual
assignment does not create fake rounds or offers.

**Rationale**: Synthetic offers pollute dispatch metrics and conflict with
round/candidate constraints. Explicit provenance preserves auditability.

**Alternatives considered**:

- Create synthetic accepted candidate: rejected because it requires a fake round
  and bypasses candidate meaning.
- Make admin accept a mechanic's offer: insufficient when no offer exists.

## Decision 10 - One canonical reassignment transaction

**Decision**: `AdminAssignmentOperationsService.reassignAssignment` owns the
transaction. The request-oriented dispatch service resolves the active
assignment and delegates to it; there is one public mutation endpoint.

**Rationale**: Two independent reassignment implementations would drift and race.

**Alternatives considered**:

- Duplicate request-based and assignment-based commands: rejected due to
  inconsistent locks and audit events.
- Force-edit mechanic on the existing assignment: rejected because it destroys
  history and conflicts with immutable provenance.

## Decision 11 - Append supervision actions, never edit used content

**Decision**: Add append-only supervision action records for diagnosis revision,
quote revision, quote dispute resolution, void, and expiry commands. Add
`voided` as a pending-quote terminal outcome. Commit the enum addition in one
migration before a following migration installs transition logic that uses it.

**Rationale**: Revision/dispute intent must be durable, while diagnosis and quote
versions remain immutable.

**Alternatives considered**:

- Edit diagnosis/quote rows: rejected by existing immutability guarantees.
- Put revision intent only in audit: rejected because workflow queries need a
  durable domain record.

## Decision 12 - Explicit notification cancellation and outbox abandonment

**Decision**: Add notification `canceled` and outbox `abandoned` terminal states
with actor/time provenance. Only failed or dead-letter items are retryable and
only when not actively leased. Commit both enum additions before a following
migration installs fields, constraints, indexes, and commands that use them.

**Rationale**: Encoding cancellation/abandonment as generic errors makes worker
behavior ambiguous and risks later delivery.

**Alternatives considered**:

- Delete pending records: prohibited.
- Mark notification sent or outbox processed: false operational history.
- Reuse failed/dead-letter forever: cannot distinguish deliberate operator
  termination.

## Decision 13 - Derive timelines and dashboards

**Decision**: Derive timelines, metrics, admin action history, and stuck workflow
findings from existing audit/history/domain rows. Do not persist a dashboard
read-model table in this MVP.

**Rationale**: Required scale is moderate and existing indexes support bounded
queries. Persisted aggregates would add synchronization and rebuild complexity.

**Alternatives considered**:

- Materialized dashboard tables: defer until measured query cost requires them.
- Store duplicate admin action rows: unnecessary after adding audit reason.

## Decision 14 - Metadata-first admin DTOs

**Decision**: Admin list, timeline, dashboard, outbox, audit, and export DTOs are
allowlisted metadata. Raw device keys, tokens, secrets, provider payloads, audio,
chatbot/rider full text, payment data, and unrestricted narrative content are
omitted. Diagnosis detail is metadata-only and does not return diagnosis,
recommended-work, or safety-note text.

**Rationale**: Admin role is not a reason to disclose every stored field. The
feature needs operational facts, not credential or raw-content access.

**Alternatives considered**:

- Return full rows and redact known keys: rejected because new sensitive fields
  could leak by default.
- Reuse rider/mechanic DTOs: rejected because admin queries require different
  relationships and stricter narrative redaction.

## Decision 15 - Configuration remains optional

**Decision**: Patch J stores only allowlisted typed operational values, is off by
default, and may be deferred without blocking Patches A-I.

**Rationale**: Fixed deployed constants are sufficient for the initial admin
layer. Runtime configuration expands operational risk and needs version history.

**Alternatives considered**:

- Environment-only configuration: retained as the fallback if Patch J is
  deferred.
- Generic key/value secret store: explicitly rejected.

## Decision 16 - No payment or chatbot changes

**Decision**: No payment, frontend, Maps/tracking, odometer, inventory,
chatbot/ASR, provider, safety, fallback, rate-limit, or logger implementation is
part of this feature.

**Rationale**: These are explicit scope exclusions and constitution gates.

**Alternatives considered**: None within feature 003.
