# Profile, lists and admin dispatch — Batches 07–09

## Quote amounts

New `standard` quotes require `0 < total_amount <= 999999999999`, the existing
payment-order amount limit. Validation runs before superseding a pending quote.
Individual zero-value lines remain allowed when the total is positive. Rescue
parts and maintenance cumulative calculations retain their existing rules.

A legacy pending standard quote outside this range returns 409 on approval;
the mechanic must issue a valid replacement. Approved legacy zero quotes remain
immutable. Use the read-only `preflight:schema --inventory` group
`standard_zero_quotes` for admin investigation; no automatic repair or synthetic
payment is provided. A positive standard quote still requires verified payment
before work. A fully paid rescue can finish with zero remaining balance.

## Self profile and rider/assignment lists

`POST /api/v1/auth/profile` bootstraps; calling it again preserves the existing
profile. `PATCH` accepts only `{ "display_name": "Tên mới" }` (trimmed, 1–120
characters). It locks the authenticated active actor, updates that actor alone
and audits the changed field without copying the name into audit/outbox.
Roles, status, account type, another user ID, rating and verified fields return
400. Suspended/archived actors cannot update.

`GET /api/v1/service-requests` and `GET /api/v1/assignments` accept:

| Query | Meaning |
|---|---|
| `status` | One valid status for that resource |
| `date_from`, `date_to` | Inclusive creation-time bounds, ISO 8601 with offset |
| `limit` | Default 20, 1–100 |
| `cursor` | Opaque `page.next_cursor` from the preceding response |

Responses keep `items` and add `page: { next_cursor, has_more }`. When there is
no next page, `next_cursor` is null. Keep the same filters when following the
cursor; stop at `has_more=false`. Unknown/duplicate queries, invalid cursors,
invalid status/date/range and invalid limits return 400. Ordering is creation
time at millisecond precision, then UUID, both descending; SQL predicates use
the same precision so sub-millisecond PostgreSQL timestamps do not lose items.

Requests always filter by the authenticated rider. Assignments preserve the
union of rider ownership and current mechanic ownership; admins can see all
assignments through the same bounded query. Quote authorization uses a scoped
existence query and is independent of the first assignment page.

**Compatibility:** list defaults now return at most 20 items. Consumers must
follow the returned cursor to restore longer histories. The current mobile/web
source has no calls to these list/profile backend routes; future consumers must
adopt this contract. New rows/status changes between pages remain a live view,
not a historical snapshot.

## Admin dispatch

All routes require an active admin JWT. Read responses use `private, no-store`.

| Route suffix under `/api/v1/admin` | Method |
|---|---|
| `/service-requests/{requestId}/dispatch` | GET status/budget/next actions |
| `/service-requests/{requestId}/dispatch/rounds` | GET round history page |
| `/dispatch/rounds/{roundId}` | GET round and candidate snapshot |
| `/service-requests/{requestId}/dispatch/eligible-mechanics` | GET eligible page |
| `/service-requests/{requestId}/dispatch/explanation` | GET all exclusions page |
| `/dispatch/rounds/{roundId}/expire` | POST overdue round expiry |
| `/service-requests/{requestId}/dispatch/retry` | POST new search episode, 202 |
| `/service-requests/{requestId}/dispatch/cancel` | POST stop matching, 200 |

Round/eligible/explanation lists accept only `limit` (default 50, max 100) and
`cursor`. Their `page` also contains `limit`. Round detail caps candidates at
100 and exposes `candidates_has_more`. The status snapshot caps history at 64
rounds and exposes `round_history_has_more`; it does not expose worker lease
owners, rider descriptions, mechanic coordinates/contact or private history.

Explanation returns every applicable exclusion for each mechanic: inactive
user, missing role, inactive profile, unavailable, skill mismatch, missing/stale
location, radius, current work, overlapping reservation and already contacted
in this episode. `reason_counts_scope=page` explicitly limits counts to returned
items. `eligible` is advisory mechanic eligibility; request-level blockers and
`next_action_codes` determine whether a command is allowed. A future scheduled
invitation checks its minimum visit window and buffers; acceptance still checks
the mechanic's supplied duration atomically.

Commands require `X-Idempotency-Key` and `{ "reason": "..." }` (10–500
characters). Same key/body replays; changed body conflicts. Locks follow request
→ rounds/candidates → active assignment. Live worker leases and assignment or
pending/approved quote/unresolved payment commitments block intervention.

Retry requires `manual_escalation`, rider eligibility, coordinates and an
unelapsed schedule. Migration 038 stores `dispatch_episode_start_round` and
`dispatch_retry_count`. Each request has at most **3 admin retries**; each new
episode still has at most **4 rounds / 360 seconds**, starting at 2 km. Radius
steps remain 2/5/8/12 km, offers expire after 60 seconds, at most 10 mechanics
are invited per round, and total history is capped at 64. Old rounds are never
deleted/reopened. A previously contacted mechanic can be reconsidered in a new
admin episode; rescue rejection/recall rules within an episode are preserved.

Cancel dispatch and admin expiry close matching and move to `manual_escalation`;
they preserve the rider's need. Canceling that need uses the existing admin
service-request `/cancel` command. Expiry requires an overdue active round and
no live worker lease. Commands and workers reuse dispatch creation, eligibility
and ranking. Inbox/outbox report search restarted or needing support, never
assignment confirmation. Every offered mechanic receives the appropriate
rescue/maintenance/appointment/general repair notification.

At the retry limit, the safe action is request cancellation or later reviewed
assignment intervention. Manual assignment/reassignment is implemented in
Batch 10; see [admin recovery](./ADMIN-RECOVERY-OPERATIONS.md) for provenance,
server distance, scheduled duration and commitment guards.

Migration 038 is applied/verified only in the separate Docker test instance.
Production rollout and real HTTP/JWT/provider/device acceptance remain pending;
see [release checklist](./SCHEMA-RELEASE-CHECKLIST.md) and the root batch report.
