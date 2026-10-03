# Data Model: CareOnRoad Admin Operations

## Design Principles

- Extend existing rows only when an explicit admin command needs durable state or
  provenance.
- Preserve append-only audit, quote immutability, diagnosis immutability after
  quote reference, and assignment uniqueness.
- Derive timelines, metrics, and dashboard findings from source records.
- Store private narrative content only in dedicated tables; never copy it into
  audit metadata or outbox payloads.
- New tables use UUID identifiers and timestamps consistent with the existing
  schema.
- New tables have RLS enabled and no direct anonymous/authenticated mutation
  grants. Admin APIs continue through the backend repository layer.

## Existing Entity Extensions

### Audit Log

Existing table: `audit_logs`

New field:

| Field | Type | Rules |
|---|---|---|
| `admin_reason` | text, nullable | Required by service policy for admin mutations; 10-500 characters; null for existing/non-admin records. |

Unchanged invariants:

- Append-only: update, delete, and truncate remain rejected.
- `metadata` remains sanitized structured data.
- Full notes, diagnosis text, raw payloads, secrets, tokens, audio, and payment
  data never enter `metadata`.

Indexes:

- Add `(actor_role, created_at desc, id)` for bounded admin-action queries.
- Existing actor/entity indexes remain.

### Application User

Existing tables: `app_users`, `user_roles`, `user_devices`

No new persistent fields are required.

Admin commands use existing values:

- User status: `active | suspended | archived`.
- Roles: `rider | mechanic | admin`.
- Device revocation: `user_devices.enabled = false`.

Additional repository operations:

- Lock user/profile and roles for update.
- Acquire shared last-admin transaction lock.
- Count active admin memberships under that lock.
- Update status.
- Grant/revoke roles without hard deletion of the user.
- Disable device under lock.

State transitions:

```text
active -> suspended
active -> archived
suspended -> active
suspended -> archived
archived -> terminal
```

Last-admin invariant:

```text
count(active app_users joined to user_roles(admin)) >= 1
```

The invariant is re-evaluated under one shared transaction advisory lock before:

- suspending an admin;
- archiving an admin;
- revoking an admin role.

### Mechanic Profile

Existing table: `mechanic_profiles`

Enum extension:

```text
mechanic_profile_status:
pending | active | rejected | suspended | banned
```

State transitions:

```text
pending -> active
pending -> rejected
pending -> banned
active -> suspended
active -> banned
suspended -> active
suspended -> banned
rejected -> terminal in feature 003
banned -> terminal in feature 003
```

Rules:

- Approve only from `pending`.
- Reject only from `pending`.
- Reactivate only from `suspended`.
- Suspend or ban is rejected while an active assignment remains.
- Force unavailable sets `is_available = false` and updates the existing
  availability timestamp; it does not cancel an assignment.
- Skills replace the existing `mechanic_skills` set atomically.
- Service radius remains `> 0` and `<= 100` km.
- `rating_avg` and `rating_count` have no admin write method.

Suggested indexes:

- `(profile_status, is_available, updated_at desc, user_id)`
- Existing PostGIS and skill indexes continue to support eligibility.

### Assignment

Existing table: `assignments`

Source text column with a CHECK constraint (migration 039):

```text
source:
offer | admin_manual | admin_reassignment
```

New/changed fields:

| Field | Type | Rules |
|---|---|---|
| `source` | text | Not null; existing rows backfilled/defaulted to `offer`. |
| `accepted_candidate_id` | UUID, nullable | Required only for `offer`; remains unique when present. |
| `assigned_by_admin_id` | UUID, nullable FK app_users | Required for admin sources; null for offer acceptance. |
| `supersedes_assignment_id` | UUID, nullable FK assignments | Required for `admin_reassignment`; unique to prevent multiple replacements of one assignment. |
| `dispatch_distance_m` | integer, nullable | Server-calculated snapshot, nonnegative and required for admin sources; authoritative candidate distance for offers. |

Source-dependent constraints:

```text
offer:
  accepted_candidate_id is present
  assigned_by_admin_id is null
  supersedes_assignment_id is null

admin_manual:
  accepted_candidate_id is null
  assigned_by_admin_id is present
  supersedes_assignment_id is null

admin_reassignment:
  accepted_candidate_id is null
  assigned_by_admin_id is present
  supersedes_assignment_id is present
```

Unchanged invariants:

- One active assignment per request.
- One current active assignment per mechanic; future reservations use the
  existing buffered exclusion constraint and activation policy.
- Assignment history is append-only.
- Offer-accepted assignments still validate candidate request/mechanic identity
  and accepted status.

Admin manual assignment:

- Locks request, mechanic profile, active request assignment, active mechanic
  assignment, and active dispatch rows.
- Validates request is explicitly assignable.
- Validates mechanic active/available, skill match, fresh location when required,
  service radius, and no active job.
- Closes active offers/rounds consistently.
- Creates an `accepted` assignment and request `assigned` history.

Admin reassignment:

- Allowed only before diagnosis begins: prior assignment status
  `accepted | en_route`.
- Changes prior assignment to `recovery_canceled` and appends history.
- Creates one replacement `accepted` assignment.
- Resets the request to `assigned` through an explicit admin transition.
- Keeps all prior assignment records.

Suggested indexes:

- `(source, created_at desc, id)`
- `(assigned_by_admin_id, created_at desc, id)` where non-null.
- Unique `supersedes_assignment_id` where non-null.

### Quote

Existing table: `quotes`

Enum extension:

```text
quote_status:
pending | approved | rejected | superseded | expired | voided
```

Migration rule: `voided` is added and committed in migration 040. Migration 041
then installs supervision records and transition logic that references it.

New transition:

```text
pending -> voided
```

Unchanged rules:

- Quote content and lines are immutable.
- Only pending versions can move to a terminal response status.
- Financial adjustments create a new quote version.
- Existing latest-pending uniqueness remains.

### Notification

Existing table: `notifications`

Enum extension:

```text
notification_status:
pending | sent | failed | canceled
```

Migration rule: notification `canceled` and outbox `abandoned` are added and
committed in migration 042. Migration 043 then adds fields, constraints, indexes,
and command behavior that reference them.

New fields:

| Field | Type | Rules |
|---|---|---|
| `canceled_at` | timestamp, nullable | Present only for canceled notification. |
| `recovery_admin_id` | UUID, nullable FK app_users | Admin responsible for the latest retry/cancel. |
| `recovery_reason` / `recovery_at` | text / timestamp | Private reason and command timestamp. |
| `admin_retry_count` | integer | Capped at 3. |

State transitions:

```text
pending -> sent
pending -> failed
pending -> canceled
failed -> pending      # controlled retry
failed -> canceled     # if policy permits cancellation before delivery
sent -> terminal
canceled -> terminal
```

Rules:

- Commands lock source event → notification → receipt rows and reject active
  leases. Cancellation requires no sent receipt; inbox read state is independent.
- Failed original receipts may retry only with a matching active credential; no
  sent/invalid/canceled receipt or newly registered device is replayed. Commands
  are bounded to 100 receipts. Receipt `canceled` is terminal.
- Admin cannot mark sent.
- Retry clears last error, leaves sent timestamp null, and coordinates related
  outbox state.

### Outbox Event

Existing table: `outbox_events`

Enum extension:

```text
outbox_status:
pending | processing | processed | dead_letter | abandoned
```

New fields:

| Field | Type | Rules |
|---|---|---|
| `abandoned_at` | timestamp, nullable | Present only for abandoned event. |
| `recovery_admin_id` | UUID, nullable FK app_users | Admin responsible for the latest retry/abandon. |
| `recovery_reason` / `recovery_at` | text / timestamp | Private reason and command timestamp. |
| `admin_retry_count` | integer | Capped at 3. |

State transitions:

```text
pending -> processing
processing -> processed
processing -> pending
processing -> dead_letter
dead_letter -> pending    # controlled retry
pending -> abandoned      # only when not leased
dead_letter -> abandoned
processed -> terminal
abandoned -> terminal
```

Rules:

- Processing events with an unexpired lease cannot be retried or abandoned.
- Retry clears lease, processed, and failure metadata as appropriate, schedules
  one new attempt, and does not recreate the original domain record.
- Abandon does not delete the event.
- Claim queries select eligible pending or expired-processing leases, excluding
  abandoned events. Notification source recovery can reopen its processed source
  only through the canonical failed-notification retry guard. Critical recovery
  handoffs cannot be abandoned; payload/dedupe/domain identity stays immutable.

## New Entities

### Admin Internal Note

Table: `admin_internal_notes`

Purpose: Store private request or assignment notes separately from audit and
outbox metadata.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `admin_id` | UUID FK app_users | Required; actor must be admin by service policy. |
| `service_request_id` | UUID FK service_requests, nullable | Exactly one target FK is present. |
| `assignment_id` | UUID FK assignments, nullable | Exactly one target FK is present. |
| `note_text` | text | 1-2,000 characters; never copied into audit/outbox. |
| `created_at` | timestamp | Required, append-only ordering. |

Constraints:

```text
(service_request_id is not null) XOR (assignment_id is not null)
```

Indexes:

- `(service_request_id, created_at desc, id)` where request is present.
- `(assignment_id, created_at desc, id)` where assignment is present.
- `(admin_id, created_at desc, id)`.

Mutation policy:

- Insert only through admin service.
- Update/delete/truncate rejected.
- Audit/outbox contain note ID, target ID, command code, and admin reason only.

### Admin Supervision Action

Table: `admin_supervision_actions`

Purpose: Append immutable diagnosis/quote revision requests and dispute outcomes
without editing diagnosis or quote content.

Action types:

```text
request_revision
void_pending_quote
expire_quote
uphold_latest_quote
```

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `action` | text with CHECK | Required; codes above. |
| `admin_id` | UUID FK app_users | Required. |
| `request_id` | UUID FK service_requests | Required. |
| `assignment_id` | UUID FK assignments | Required and must match the target quote/diagnosis. |
| `diagnosis_id` | UUID FK mechanic_diagnoses, nullable | Required for diagnosis revision. |
| `quote_id` | UUID FK quotes, nullable | Required for quote actions. |
| `reason` | text | 10-500 characters. |
| `created_at` | timestamp | Required. |

Constraints:

- Exactly one quote/diagnosis target; diagnosis allows only request_revision.
- Active admin and request/assignment/target identity checked at insert.
- Action rows reject update/delete/truncate; RLS and direct client write revocation apply.
- Full diagnosis/quote narrative is not stored.

Indexes:

- `(request_id, created_at desc, id)`
- `(quote_id, created_at desc)`; diagnosis filtering is bounded by request page index.

### Operational Configuration (Optional Patch J)

Tables:

- `admin_operation_configs`: current effective allowlisted values.
- `admin_operation_config_versions`: append-only prior/new value history.

Current configuration fields:

| Field | Type | Rules |
|---|---|---|
| `config_key` | text | Primary key; allowlisted key only. |
| `value_json` | JSON | Schema validated per key; secret-like keys prohibited. |
| `version` | integer | Positive and incremented atomically. |
| `updated_by` | UUID FK app_users | Required. |
| `updated_at` | timestamp | Required. |

Configuration current rows additionally store a private sanitized `reason`;
GET responses omit it. Active-admin provenance, sequential version increments,
cross-field budget and exact-key/value checks are enforced by migration 045.

Version fields:

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary key. |
| `config_key` | text | Required. |
| `version` | integer | Unique with key. |
| `previous_value_json` | JSON, nullable | Sanitized. |
| `new_value_json` | JSON | Sanitized. |
| `updated_by` | UUID FK app_users | Required; active administrator at mutation time. |
| `reason` | text | 10-500 characters. |
| `created_at` | timestamp | Required; append-only. |

Initial allowlist:

- Dispatch radius steps.
- Dispatch offer expiry.
- Dispatch maximum rounds.
- Dispatch total wait.

Only those four dispatch values are mutable. Dashboard thresholds are constants;
feature flags and maintenance mode have no mutation endpoint. Provider budget
metadata is read-only and reports null usage/limit/remaining when unavailable.

Explicitly prohibited:

- API keys, tokens, credentials, passwords, database URLs, worker secrets,
  service-role keys, raw provider payloads, payment values, or arbitrary keys.

## Derived Read Models

No new table is created for these models.

### Admin User Summary

- User ID, masked profile fields, status, roles, device counts, active workflow
  counts, created/updated timestamps.
- No auth identity credentials or raw device key.

### Admin Mechanic Summary

- User ID, profile status, availability, service types, service radius, location
  freshness category, trusted rating aggregates, active-workload category, work
  outcome counts.
- No raw location history; latest coordinates are omitted from list responses.

### Admin Request Summary

- Request ID/code, service type, priority, status, rider/motorcycle IDs,
  location-presence/freshness metadata, dispatch/assignment/quote summary, dates.
- No full problem text, raw safety answers, full address, or raw media.

### Dispatch Failure Explanation

Reason categories use current shared dispatch codes such as `user_inactive`,
`mechanic_role_missing`, `profile_inactive`, `skill_mismatch`, `unavailable`,
`location_missing`, `location_stale`, `outside_radius`, `current_work`,
`reservation_conflict`, `already_contacted`, `search_exhausted` and
`request_state_not_dispatchable`. Explanation counts describe only the returned
page, not a global mechanic count. See apps/api/PROFILE-LISTS-ADMIN-DISPATCH.md.

The explanation does not return rejected mechanic coordinates or private history.

### Admin Audit View

- Audit ID, actor ID/role, action, target type/ID, request ID,
  `has_admin_reason`, allowlisted sanitized metadata, created time. Private
  reason content is omitted from queries and exports.

### Stuck Workflow Finding

| Field | Meaning |
|---|---|
| `category` | One of nine implemented stuck categories. |
| `target_id` | Safe identifier; stable finding `id` is target/category-derived. |
| `age_seconds` | Age of the detected basis, never negative. |
| `failure_count` | Optional repeated-failure count. |
| `active_lease` | Current lease metadata where applicable. |
| `next_action_codes` | Safe investigation/read/note categories. |
| `detected_basis_at` | Source timestamp; thresholds are returned separately. |

Required categories:

- Overdue active dispatch round.
- Offered request without a valid offer.
- Assignment beyond state threshold.
- Request/assignment state mismatch.
- Outbox dead letter.
- Repeated reminder failure.

Implemented categories also include latest pending quote, stale pending/created/
needs-review payment, and outbox worker missing progress. Finding IDs are stable
UUIDs derived from target/category; DTO uses `target_id`, `detected_basis_at`,
`age_seconds` and `next_action_codes`. Historical reminder failures are preserved,
but disabled, postponed or successfully processed rules do not appear as stuck.

## Data Retention and Deletion

- No hard-delete command is added.
- User archive, notification cancel, and outbox abandon are durable terminal
  outcomes.
- Admin notes, supervision actions, config versions, and audit logs are
  append-only.
- Existing retention indexes remain; any future retention worker is outside
  feature 003 and must preserve required audit/history policy.

## Migration Ordering

1. `202606250015_admin_foundation.sql`
2. `202606250016_admin_mechanic_management.sql`
3. Existing backend feature migrations 017–038 (already occupied; retain history)
4. `202606250039_admin_assignment_provenance.sql`
5. `202606250040_admin_quote_status.sql` — enum-only
6. `202606250041_admin_supervision_actions.sql`
7. `202606250042_admin_delivery_statuses.sql` — enum-only
8. `202606250043_admin_delivery_operations.sql`
9. `202606250044_admin_reminder_dashboard.sql` — reminder owner guard and derived dashboard indexes.
10. `202606250045_admin_dispatch_configuration.sql` — explicitly authorized Patch J current/version rows and immutable per-round policy snapshot.
11. `202606250046_dispatch_radius_policy_bounds.sql` — dispatch radius CHECK accepts 1,000–100,000 meters. Shared dispatch conversion rounds configured km to the nearest meter for ranking, persistence and read explanations.

Each migration is independently static-tested and included in the all-migrations
integration suite. Admin additions 039–046 do not create payment state or provider
objects. Services read existing feature 005 commitments; they cannot advance money.
H2/I/J are implemented by Batches 13/15. Reminder failure_count preserves historical failures; findings exclude postponed or successfully processed rules. Config current rows carry a sanitized reason; history uses updated_by/created_at and is bounded to latest 20 metadata entries in the read API. Defaults fill absent keys. Dispatch rounds persist the policy used by their episode; legacy rounds without snapshots retain original defaults.
