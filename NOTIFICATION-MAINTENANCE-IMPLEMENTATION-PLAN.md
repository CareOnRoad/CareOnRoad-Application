# Notification and maintenance implementation plan

## Agreed behavior

- Backend only; mobile remains a prototype. No new dependencies, deployment, seeding or hosted migration execution.
- Creating a periodic-maintenance request immediately starts mechanic matching through durable outbox delivery. Booking remains pending until an offer is accepted.
- For a scheduled visit, offer acceptance requires the mechanic's estimated_duration_minutes (15–480). It creates a confirmed reservation, with 30 minutes before and after the visit reserved for travel. Mechanics can accept other non-overlapping jobs. Immediate jobs default to a conservative 120-minute estimate, or accept a supplied estimate.
- Use the existing assignment with separate scheduled/reservation/activation fields; preserve current quote/payment workflows, including the existing migration 034 changes. Future reservations do not count as current workload. Travel requires the scheduled preparation window, mechanic availability and no other active assignment; ongoing work that overruns still blocks activation.
- At 30 minutes before the visit, the dispatch worker creates deduplicated preparation notifications for both parties. It does not silently confirm, cancel or reassign appointments.
- Reminder-origin requests support immediate or scheduled visits. Location is required. Reminder recurrence stays calendar based.

## Delivery and reminders

- Persist occurrence, inbox notification, notification.created outbox and recurrence atomically, one rule per transaction. queued means inbox persisted, not push success. Preserve the deprecated sent counter as zero and expose last_processed_at.
- Use notification-specific safe navigation metadata, not the audit sanitizer. Notify offer, acceptance, travel, quote decisions, verified payment and completion without duplicating existing rescue/maintenance notifications.
- Claim outbox events just before processing; use unique execution identity, lease renewal and per-receipt fencing. Keep terminal receipts immutable. Provider delivery is at least once across the send/commit crash boundary.
- Read typed FCM detail errors before generic status; disable only the matching credential version. Propagate Retry-After for 429/503; quota backoff is at least 60 seconds.
- Clear stale snooze on schedule update; snooze must postpone the effective due time. Archive disables rules atomically and worker checks motorcycle/user activity.
- Add reminders to independent worker loops, lazy push configuration, complete readiness checks and accurate failure counters.

## Compatibility and repair

- Add an idempotent owner-only PATCH for submitted maintenance requests before matching starts, to repair legacy missing locations. Never synthesize coordinates.
- Migration 035 follows existing 034: reservation constraints/indexes, receipt leases and scheduled reminder-origin constraint.
- Provide a dry-run-first repair command for explicitly selected orphaned occurrence IDs. Reuse notification dedupe, skip consumed occurrences/inactive resources, preserve recurrence. Never replay all old events automatically.
- Known domain-only outbox topics explicitly acknowledge; unknown actionable topics fail.

## Acceptance checks

- Reminder produces exactly one inbox entry without a device; retries, archive, snooze and per-rule rollback remain correct.
- Creating a booking triggers matching; acceptance confirms only a valid, non-overlapping reservation. Two concurrent acceptances are serialized and database constraints reject overlap. Future reservations do not block unrelated current work.
- Early travel and conflicting activation fail; preparation notification dedupes. Quote/payment behavior from migration 034 stays intact.
- Concurrent delivery, lease loss, stale completion, real-shaped FCM errors and Retry-After are covered by regression checks.
- Run API tests, typecheck, lint and all-app build. Database integration requires a separately confirmed test database; no hosted mutation without explicit authorization.

## Progress

- [x] Reminder/inbox bridge and data filtering
- [x] FCM retry and delivery concurrency
- [x] Immediate matching, reservations and preparation
- [x] Legacy repair and worker configuration
- [x] API regression tests: 168 files / 564 tests; focused follow-up checks passed
- [x] API typecheck and lint; all-app build (API and web) passed
- [ ] PostgreSQL integration on a separate confirmed test database; currently configured test DB is the application DB, so execution is intentionally deferred

Implementation and API usage: [apps/api/MAINTENANCE-NOTIFICATIONS.md](apps/api/MAINTENANCE-NOTIFICATIONS.md).

## HTTP acceptance follow-up

- [x] Freeze an independent oracle from business/API/provider contracts before auditing implementation; retain baseline reports and test hashes.
- [x] Run the 303-case baseline through HTTP, real Supabase JWTs and private PostgreSQL schema:257 PASS,35 FAIL,11 BLOCKED. Some failures were fixture/contract errors; do not interpret this as35 backend defects.
- [x] Fix four reproduced backend gaps: concurrent same-key request replay, calendar-overlap offer filtering, signed currency-mismatch review handling and payOS outage classification. Preserve signature rejection and zero credit for mismatches.
- [x] API regression after four fixes:168 files /568 tests. Final workspace recheck including concurrent health/schema changes:169 files /578 tests; API typecheck/lint and all-app build passed.
- [x] Real payOS create/read/cancel smoke and missing-FCM restart smoke passed; no bank transfer or physical device receipt was inferred.
- [x] Finish isolated HTTP rechecks and aggregate final evidence by case ID:301 PASS,0 FAIL,5 BLOCKED /306 distinct cases. This is baseline plus targeted rechecks, with source provenance per run. The separate guarded DB suite remains deferred; private-schema HTTP checks provide actual PostgreSQL evidence without running that suite on application data.
- [x] Payment/push process crash recovery and stale-success/credential-rotation fencing passed with actual owned process control and simulated provider wire responses.
- [x] Genuine legacy fixtures created through the Git pre-034/035 API, then upgraded in a private schema: unpaid standard prepayment, preserved paid order and owner-only missing-location repair passed.
- [ ] Physical Android/iOS receipt and bank settlement still require their own observers/execution.

Test source and usage: [tests/workflows/README.md](tests/workflows/README.md).
Final evidence: [tests/workflows/FINAL-REPORT.md](tests/workflows/FINAL-REPORT.md).
