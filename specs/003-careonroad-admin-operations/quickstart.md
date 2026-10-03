# Quickstart Validation: CareOnRoad Admin Operations

Current local status: Patches A–I and explicitly authorized J are implemented.
Source/local schema requires 046. Batch 14 exercises real local Supabase JWT,
Next HTTP and PostgreSQL with a simulated payOS provider. Real provider/device
acceptance and production rollout remain pending. See the root
BACKEND-FIX-BATCHES-REPORT.md for final run results and limits.

## Purpose

Validate feature 003 after each patch without requiring frontend work or real
external providers. This guide proves authorization, command safety,
transactions, audit/outbox, redaction, and operational recovery.

References:

- [Feature specification](spec.md)
- [Implementation plan](plan.md)
- [Data model](data-model.md)
- [Admin API contract](contracts/admin-api.yaml)

## Prerequisites

- Node.js and project dependencies are installed.
- Existing migrations `202606250001` through `202606250046` are applied on the
  independently confirmed local Docker test instance.
- `TEST_DATABASE_URL` points to an isolated test database when PostgreSQL
  integration tests are run.
- Supabase JWT test fixtures include:
  - one active admin;
  - one second active admin for last-admin concurrency tests;
  - one active rider;
  - one active mechanic;
  - one suspended user.
- No real Gemini, OpenRouter, notification, payment, Maps, or ASR provider is
  called by feature tests.

Never print or commit environment values, database URLs, service-role keys,
worker secrets, seeded passwords, or access tokens.

## Baseline Commands

```powershell
pnpm.cmd run typecheck
pnpm.cmd run lint
pnpm.cmd test
pnpm.cmd run test:db
pnpm.cmd run build
pnpm.cmd run test:http
```

Expected:

- Existing chatbot, ASR, rider, mechanic, assignment, quote, reminder, worker,
  and persistence tests remain green.
- No new frontend route or UI component is produced.
- Existing feature 005 payments remain available; these admin patches do not
  add payment routes/providers or advance ledger state. Commitment reads block
  unsafe cancellation/reassignment/supervision.

## Migration Validation

Use the separate Docker test workdir from apps/api/SCHEMA-RELEASE-CHECKLIST.md.
The linked hosted project in this task is production and must not be used.
The following alternative commands apply only to a separately confirmed linked
test/development Supabase project:

```powershell
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
```

Before applying:

- Confirm source history is contiguous through 046; admin additions are 039–046.
- Confirm enum-only migrations 040 and 042 commit before command usage from 041
  and 043. Dependent DDL uses text comparison to remain safe in test lifecycle.
- Confirm these admin additions do not create payment state or provider objects.
- Confirm all changes are additive or safely loosen existing assignment
  provenance constraints.
- Confirm new admin-only tables have RLS enabled and no direct anonymous or
  authenticated mutation grants.

Apply only after dry-run review:

```powershell
npx.cmd supabase db push
```

## Patch A Validation - Foundation

1. Run admin authorization route tests.
2. Verify missing bearer authentication returns 401.
3. Verify invalid bearer authentication returns 401.
4. Verify an active non-admin returns 403.
5. Verify an active admin reaches the injected test service.
6. Submit mutations with missing, blank, short, and oversized reasons; verify
   validation rejects each.
7. Verify sensitive nested fields are removed from admin-safe DTOs.
8. Create an internal note and verify:
   - note text is stored only in the note row;
   - audit and outbox contain note/target IDs but not note text;
   - rider and mechanic responses do not include the note.

## Patch B Validation - User Management

1. List users with a page limit of 2 and follow the returned cursor.
2. Repeat the first page after inserting a newer user; verify cursor ordering
   does not duplicate or skip the original continuation.
3. Suspend and reactivate an eligible rider with an idempotency key.
4. Replay the same command/key and verify no duplicate audit/outbox effect.
5. Reuse the key with a different payload and verify conflict.
6. Revoke an enabled device and verify no raw key appears.
7. Attempt to suspend, archive, and revoke the admin role from the only active
   admin; verify all are rejected.
8. Run two concurrent last-admin mutations with two admins; verify at least one
   active admin remains.

## Patch C Validation - Mechanic Management

1. Approve a pending mechanic.
2. Reject a different pending mechanic and verify it remains non-dispatchable.
3. Suspend and reactivate an eligible mechanic.
4. Ban a mechanic and verify generic reactivation is rejected.
5. Attempt suspension with an active assignment and verify conflict.
6. Replace skills and service radius and verify subsequent eligibility reflects
   them.
7. Force unavailable and verify active assignment history remains unchanged.
8. Verify no route or service can set rating average/count.

## Patch D Validation - Service Requests

1. List and inspect request metadata as admin.
2. Verify full rider problem text, raw safety answers, full address, and raw
   media are absent from list/timeline DTOs.
3. Cancel an eligible request with active offers; verify request, round, and
   candidates become consistent in one transaction.
4. Force an outbox/audit failure in an injected test dependency; verify the
   request and dispatch rows roll back.
5. Manually escalate an eligible request.
6. Add an internal request note and verify admin-only privacy.
7. Attempt arbitrary status input and verify no such route exists.

Automated Patch D coverage verifies that rider-owned
`GET /api/v1/service-requests/{requestId}` responses never contain
`admin_internal_notes`, `admin_notes`, or note text created through the admin
operation.

## Patch E Validation - Dispatch

1. Seed an active round whose expiry time has passed.
2. Expire it and verify all open candidates close while terminal candidates
   remain unchanged.
3. Retry dispatch and verify one new valid round is created.
4. Race expiry against mechanic acceptance; verify one consistent winner.
5. Verify each dispatch failure reason fixture:
   - no matching skill;
   - stale location;
   - unavailable;
   - outside service radius;
   - active job;
   - maximum rounds;
   - request not dispatchable;
   - no valid offer remains.
   For every seeded combination, verify one explanation response contains every
   applicable category, safe counts where meaningful, only next-command
   categories valid for the current request state, and no private location
   history or secrets.
6. Manually assign an eligible mechanic.
7. Attempt manual assignment for every ineligible condition and verify conflict.
8. Run two concurrent manual assignments; verify one active assignment.

## Patch F Validation - Assignment

1. Cancel an assignment from an allowed state and verify request synchronization.
2. Attempt cancel from an unsupported state and verify conflict.
3. Reassign a pre-diagnosis assignment to an eligible mechanic.
4. Verify the old assignment/history remains and the replacement has admin
   provenance.
5. Run two concurrent reassignments; verify exactly one replacement wins.
6. Submit unsupported stuck action and verify validation rejects it.
7. Add an assignment note and verify note privacy.
8. Verify no force-status route or service exists.

## Patch G Validation - Diagnosis and Quote

1. Retrieve the admin-safe diagnosis detail and quote version history.
2. Request diagnosis revision and verify the diagnosis row is unchanged.
3. Request quote revision and verify existing quote content is unchanged.
4. Void and expire separate eligible pending quotes.
5. Race rider approval against admin void; verify one terminal outcome.
6. Resolve a dispute using each allowlisted resolution.
7. Verify changed financial content can only appear in a new quote version.
8. Search audit/outbox and verify no full diagnosis or quote narrative appears.

## Patch H Validation - Audit and Worker Operations

1. Search audit by actor, entity, action, and date range.
2. Export exactly the allowed bound and verify a request above the bound is
   rejected.
3. Verify audit queries do not modify, delete, reorder, replace, or increase the
   count of source audit rows.
4. Verify each successful export preserves every existing source audit row and
   appends exactly one sanitized export-access audit record containing only the
   requesting admin, filter hash, exported count, and timestamp.
5. Verify exported content is not copied into the export-access audit record.
6. Retry a failed notification and cancel a separate pending notification.
7. Race notification cancel against delivery; verify one consistent outcome.
8. Retry a dead-letter event and verify original domain rows are not duplicated.
9. Attempt retry/abandon on a live lease and verify conflict.
10. Abandon an eligible dead-letter event and verify it remains stored.
11. Retry a failed reminder occurrence twice and verify no duplicate rider-facing
   result.
12. Verify sent/dismissed occurrence retry is rejected.

## Patch I Validation - Dashboard

1. Seed known counts for users, mechanics, requests, assignments, notifications,
   outbox, and reminders.
2. Verify each aggregate equals source records.
3. Seed one fixture for each required stuck category.
4. Verify each appears once with reason and safe next-command categories.
5. Read all dashboard endpoints twice and verify no row changes.
6. Run the bounded dashboard performance acceptance scenario described below.

## Patch J Validation - Optional Configuration

Run only if Patch J is authorized:

1. Verify only these keys can be mutated:
   - `dispatch.radius_steps_km`: 1 to 8 ascending values, each 1 to 100 km,
     default `[2, 5, 8, 12]`;
   - `dispatch.offer_expiry_seconds`: integer 30 to 300, default `60`;
   - `dispatch.max_rounds`: integer 1 to 8, default `4`;
   - `dispatch.total_wait_seconds`: integer 60 to 1,800, greater than or equal to
     offer expiry, default `360`.
2. Update each allowlisted dispatch value at its valid boundaries.
3. Verify current value, version history, audit, and outbox.
4. Verify provider budget limits and usage metadata are read-only and contain no
   credentials.
5. Submit unknown, feature-flag, provider-budget, maintenance-mode,
   out-of-range, credential-like, and payment-like mutations; verify rejection.
6. Verify no configuration change alters chatbot/provider selection, provider
   order, fallback, safety, ASR, worker authorization, or emergency advice.

Maintenance mode remains deferred unless a later explicit policy defines its
blocked and allowed command categories, HTTP error category, and active-workflow
effects.

## Cross-Patch Performance Acceptance

Use an isolated PostgreSQL test dataset containing at least:

- 100 users;
- 50 mechanics;
- 100 service requests;
- 50 assignments;
- 500 audit logs;
- 100 notifications/outbox events;
- 100 reminders/occurrences;
- internal notes and configuration rows only when their patches are included.

For every bounded admin list and detail operation:

1. Execute five warm-up requests.
2. Execute 20 measured requests.
3. Verify at least 19 of 20 complete within two seconds.
4. Verify every accepted response respects its documented page or export bound.

## Final Scope Guard

Before considering feature 003 ready:

- Verify admin patches add no payment routes/providers/ledger advancement;
  existing feature 005 commitment reads must still block unsafe intervention.
- Confirm no frontend files changed for admin workflows.
- Confirm no Maps, tracking, inventory, odometer, chatbot, ASR, provider-order,
  safety-gate, fallback, post-validation, rate-limit, or logger rewrite exists.
- Confirm all admin mutations require reason and idempotency key.
- Confirm all list operations are bounded.
- Confirm no direct rating setter, hard delete, force-status, audit mutation, or
  raw secret/private payload response is exposed.

## Role-flow Batches 09–12 status

Dispatch reads/expiry/retry/cancel, manual assignment provenance, assignment
intervention, immutable supervision, delivery recovery and audit export are
implemented through Patch H1. Tests use the shared services and real PostgreSQL
with provider stubs/test authenticators. Final gate: 712 unit, 118 SQL, 14 audit,
typecheck/lint/build and schema preflight 043 PASS.

Validate scheduled manual duration/reservation buffer and server rescue distance;
closed quote history may be canceled only by canonical admin before work/money.
Quote revision closes the latest pending version; approved labor is unchanged and
expiry requires an explicit passed timestamp. Delivery retry caps at three and
100 original receipts per command, preserves inbox read state and blocks active
leases/critical abandonment. Audit export caps at 10,000 rows/31 days/5s and
appends one sanitized access record. See apps/api/ADMIN-RECOVERY-OPERATIONS.md.

Patch H2/I and optional J are implemented in Batches 13/15. Reminder recovery
preserves failure history and original notification context; dashboard exposes
nine categories including the original six; configuration is off by default and
pins policy per dispatch episode. See apps/api/ADMIN-REMINDER-DASHBOARD-CONFIGURATION.md.

`test:http` uses the named Docker Auth container and an isolated DB schema. It
creates temporary Auth accounts, verifies real ES256 JWT against local JWKS,
runs the built Next server, and checks workflow changes through role APIs.
Standard/rescue/maintenance money transitions use signed simulated payOS HTTP
responses and webhooks; no paid/completed SQL fixtures replace those steps.
Actual process restarts cover accepted job restoration, initialized payment
reconciliation and leased outbox recovery. Retry/expiry clocks are advanced only
for temporary test rows; operational failure injection is documented separately.

The performance scenario seeds the minimum dataset above and measures every
contracted admin GET, including bounds and secret scans. Native SQL tests cover
all nine stuck categories, races, RLS and append-only history. These are local
acceptance results. Verified real payOS transactions, Android/iOS FCM receipt,
enabled ETA/live tracking and hosted smoke tests require separate environments
and remain pending; do not use the linked production project for local validation.
