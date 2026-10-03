# Admin recovery operations — Batches 10–12

Implemented and verified locally on 02/10/2026. Apply source migrations through
`202606250043_admin_delivery_operations.sql` before enabling these routes.
039–043 have been applied only to the separate Docker test instance. Production
rollout and real provider/device acceptance remain pending. Batch 14 now has
local HTTP/Supabase JWT/PostgreSQL evidence; see the root batch report.

All routes below use `/api/v1`, require a verified JWT and a currently active
admin role. POST commands require `X-Idempotency-Key` (8–200 characters) and a
JSON `reason` (10–500 characters). Reusing a key with different input returns
409. Authorization is checked again after contested locks. Reasons and internal
notes stay private; responses, audit exports and notification content redact them.

## Assignment operations

| Method | Route | Purpose |
|---|---|---|
| POST | `/admin/service-requests/{requestId}/dispatch/manual-assign` | Assign an eligible mechanic without inventing an offer |
| GET | `/admin/assignments/{assignmentId}` | Redacted detail, commitment reasons and safe actions |
| GET | `/admin/assignments/{assignmentId}/timeline` | Bounded status/admin-action history |
| POST | `/admin/assignments/{assignmentId}/reassign` | Replace eligible pre-quote work atomically |
| POST | `/admin/assignments/{assignmentId}/cancel` | Cancel before work/agreement/unresolved money |
| POST | `/admin/assignments/{assignmentId}/resolve-stuck` | Allowlisted cancel/reassign/investigate |
| POST | `/admin/assignments/{assignmentId}/notes` | Append a private internal note |

Manual assignment/reassignment input:

```json
{
  "reason": "Đã kiểm tra và xác nhận thợ phù hợp",
  "mechanic_id": "<mechanic UUID>",
  "estimated_duration_minutes": 90
}
```

`estimated_duration_minutes` is required for scheduled visits; allowed range is
15–480. Reservations include 30 minutes before the visit and 30 minutes after
estimated completion. Future reservations remain separate from current work.
The read DTO reports `work_slot`: `current`, `future_reservation`, or `closed`.

Manual assignment accepts only unassigned `submitted`, `dispatching`, `offered`
or `manual_escalation` requests. Rider, motorcycle and target mechanic must be
eligible now; coordinates, skills, availability, fresh location (300 seconds),
radius, current work and the full reservation interval are rechecked. Pending/
approved quotes, active assignment, a live dispatch worker lease and unresolved
money block the command. Scheduled visits cannot be assigned after their start.

The persisted `source` is `offer`, `admin_manual`, or `admin_reassignment`.
Manual sources return `accepted_candidate_id: null`; admin provenance is stored
without a fake candidate. `dispatch_distance_m` is calculated by the server and
used by rescue labor pricing. Offer acceptance stores the authoritative candidate
distance; legacy rescue quotes retain the candidate fallback.

Reassignment requires `accepted`/`en_route`, with no issued quote, agreement or
unresolved payment. The prior assignment becomes `recovery_canceled`; its
replacement references `supersedes_assignment_id`. Request/assignment histories,
dispatch closure and rider/mechanic notifications commit in one transaction.
Existing unique/current-slot and reservation exclusion constraints still apply.

`resolve-stuck` accepts `action: cancel | reassign | investigate`; reassign also
needs the target mechanic, investigate needs `note` (1–2,000 characters). Notes
use `note`. There is no arbitrary status, forced completion or payment
advancement command. Detail action codes are advisory; POST always rechecks guards.

## Diagnosis and quote supervision

| Method | Route | Purpose |
|---|---|---|
| GET | `/admin/assignments/{assignmentId}/diagnosis` | Diagnosis metadata, audit history and supervision |
| POST | `/admin/diagnoses/{diagnosisId}/request-revision` | Request revision before diagnosis is referenced by any quote |
| GET | `/admin/quotes/{quoteId}` | Quote metadata and supervision history |
| GET | `/admin/service-requests/{requestId}/quotes/history` | Immutable quote version metadata |
| GET | `/admin/service-requests/{requestId}/supervision-actions` | Append-only supervision history |
| POST | `/admin/quotes/{quoteId}/request-revision` | Void latest pending version and require a new version |
| POST | `/admin/quotes/{quoteId}/void` | Void eligible latest pending quote |
| POST | `/admin/quotes/{quoteId}/expire` | Expire only when explicit `expires_at` has passed |
| POST | `/admin/service-requests/{requestId}/quote-dispute/resolve` | Resolve with an allowlisted action |

Revision/void/expire bodies contain `reason`; dispute bodies also contain
`resolution: request_revision | void_pending_quote | uphold_latest_quote`.
Upheld quotes are recorded as an advisory decision; admin does not approve them
for the rider. Legacy invalid standard totals require investigation, not mutation.

Published quote content/lines/versions and referenced diagnoses remain immutable.
Diagnosis revision is available only at `on_site`/`diagnosis`, before any quote
references it; it records a request, rather than editing the diagnosis itself.
Admin void/revision/expiry and rider approval share the same locks: only one
terminal decision can commit. Expiry cannot substitute for void when a quote
has no expiry or has not expired.

After closure, pre-travel labor returns to `accepted`/`assigned`; standard/final
work before service returns to `diagnosis`/`in_service`; a pending maintenance
addition preserves already approved work in progress. Approved labor agreements
and payment rows remain unchanged. Quote-specific unresolved money blocks closure.

Canonical admin cancellation may use closed `voided`/`rejected`/`expired` quote
history only before work, approved agreement and unresolved money. Rider cancel
and mechanic recovery retain their stricter issued-quote guards. Revision cannot
be used to cancel already paid or started work.

## Notification and outbox operations

| Method | Route | Purpose |
|---|---|---|
| GET | `/admin/notifications` | Bounded redacted list |
| GET | `/admin/notifications/{notificationId}` | Metadata and paginated receipt states |
| GET | `/admin/notifications/delivery-summary` | Bounded-window counts |
| POST | `/admin/notifications/{notificationId}/retry` | Retry eligible original failed receipts |
| POST | `/admin/notifications/{notificationId}/cancel` | Stop delivery before any receipt was sent |
| GET | `/admin/outbox` | Bounded redacted list |
| GET | `/admin/outbox/{eventId}` | Metadata, lease flag and advisory next actions |
| GET | `/admin/outbox/dead-letter` | Dead-letter queue |
| GET | `/admin/outbox/worker-health` | Existing operational worker-run history |
| POST | `/admin/outbox/{eventId}/retry` | Retry a supported dead-letter event |
| POST | `/admin/outbox/{eventId}/abandon` | Stop a safe historical event |

List filters: `status`, notification `user_id` or outbox `topic`, `from`, `to`,
`limit`, `cursor`. Dates are ISO timestamps; window defaults to the last seven
days and cannot exceed 31 days. Pagination defaults to 20, maximum 100, using
opaque `(created_at, id)` cursors. Summary accepts only `from`/`to`; worker-health
accepts `limit`/`cursor`.

Retry requires a failed notification, terminal source event, no live event or
receipt lease, an active owner and a matching enabled encrypted delivery
credential/version. It retries only original `retryable_failed`/`permanent_failed`
receipts; sent/invalid/canceled receipts and newly registered devices are excluded.
Receipt attempts are retained; outbox retry resets its attempt schedule. Admin
retry is capped at three per notification/event. Commands reject fan-out above
100 receipts; reads remain paginated.

Cancellation leaves the inbox and its unread/read state intact, closes unfinished
receipts and abandons unfinished notification delivery. Sent notifications or any
sent receipt cannot be canceled. Abandoned events and canceled delivery are
terminal; workers cannot claim them or commit an old lease outcome over them.
An active provider attempt blocks admin intervention. These database safeguards
do not establish exactly-once delivery at an external provider after a timeout.

Outbox retry preserves payload, dedupe key and domain identity. Supported domain
topics reuse existing consumers; historical topics may be abandoned. Critical
`assignment.recovery.requested` handoff can be retried, but cannot be abandoned;
unknown topics cannot be discarded. Notification events delegate to canonical
notification recovery in the same transaction. No admin command calls FCM or
manually marks delivery sent.

## Audit queries and export

GET routes: `/admin/audit`, `/admin/audit/admin-actions`,
`/admin/audit/actors/{actorId}`, `/admin/audit/entities/{entityType}/{entityId}`,
and `/admin/audit/export`.

Filters use `actor_id`, `entity_id`, `entity_type`, `action`, `from`, `to`.
Query pages use `limit`/`cursor` (20/100 default/max); export accepts no cursor,
defaults to 1,000 rows and caps at 10,000. The same seven-day default/31-day maximum
date window applies. PostgreSQL audit queries have a five-second statement timeout.

Export returns JSON `{ items, exported_at, exported_count, has_more }`. Each
successful export appends exactly one `admin.audit.exported` access record with
requesting admin, filter SHA-256, count and timestamp. Existing source rows remain
unchanged; exported content is never copied into that access record. DTOs exclude
raw reasons, narratives, delivery credentials, provider payloads and raw errors.

## Local validation and rollout

Run from repository root using the isolated test configuration:

```powershell
pnpm.cmd test
pnpm.cmd run test:db
pnpm.cmd run test:audit
pnpm.cmd run typecheck
pnpm.cmd run lint:api
pnpm.cmd run build
pnpm.cmd run preflight:schema --test --inventory
```

Do not run typecheck concurrently with Next build. Source migrations 040 and 042
are enum-only; apply them in order and commit before 041/043 command usage. The
local test lifecycle also verifies ordered migrations without unsafe enum literals
in dependent DDL. New supervision records use RLS and reject update/delete/truncate.

Batch 13 (reminder recovery/dashboard) and Batch 14 (deployed acceptance) remain
pending. The local tests use real PostgreSQL with test authenticators and provider
stubs. Follow the [schema checklist](./SCHEMA-RELEASE-CHECKLIST.md) for a separately
reviewed production rollout; never use production as a local validation database.
