# HTTP workflow acceptance tests

Run from the repository root with Node 24+ and installed workspace dependencies:

```powershell
node tests/workflows/run.mjs --list
node tests/workflows/run.mjs
```

This suite calls the Next API through HTTP, authenticates genuine Supabase users,
and checks persistent PostgreSQL results. It does not import application services,
repositories, handlers, or existing unit-test expectations. The oracle comes from
published business workflows/API contracts and official payOS/FCM wire contracts.
The runner saves the case catalogue and SHA-256 hashes **before execution**.

The suite requires `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` from local environment files. Credentials, JWTs, device
tokens and webhook secrets are never written into reports or the collection.

Each run creates a fresh private `cor_http_*` schema, installs the repository's
unchanged migrations there, and launches a private API on port 3210. Database
search_path is configured per connection. An isolation check must succeed before
workers are allowed to run. No migration or business record in `public` is modified.
Fresh Auth fixture accounts are locked after the run. The private schema remains
for read-only investigation; results list its name and owned fixture IDs.

payOS and FCM responses are controlled at the network boundary of this API process.
The suite uses no real bank transfer, and no real push provider. Business time is
controlled for expiry/snooze/retry tests; JWT cryptographic verification still uses
real wall time. SQL prepares the private administrator role and reads evidence;
it never marks an order paid or manufactures request/assignment workflow state.

| Group | Coverage |
|---|---|
| SEC | Missing/invalid JWT, protected routes, worker secret cannot be replaced by user/admin JWT, error redaction |
| MNT | Input/ownership/idempotency, automatic matching, reservation confirmation, state synchronization and guards, fixed labor, rejected/revised/superseded/expired quotes, approved/rejected cumulative additions, quote-bound checklist, no-part and part E2E variants, future appointments, no available mechanic, completion and review |
| PAY | Pay-after-service only, immutable server amount, order ownership/idempotency/concurrency, cancel/recreate, bad/tampered/unknown webhooks, under/over/currency/link mismatch, duplicate/concurrent success, late payment, provider-verified admin resolution, missing webhook reconciliation, provider outage |
| NTF | Due/recurring/disabled/snoozed/archived reminders, reminder-to-maintenance E2E, owner-only inbox/navigation/pagination/unread state, device rotation/revocation, FCM typed invalid token/permanent/transient/quota errors, Retry-After, mixed devices, concurrent workers, dead letters, maintenance and both rescue payment flows |

`test-cases.json` contains every case with its explicit expected result.
`TEST-CASES.md` is the readable catalogue. `LATEST.md` links the most recent result;
each immutable `reports/<run>/` contains the frozen catalogue, HTTP trace, outcomes,
cleanup result and report. FAIL and BLOCKED both cause nonzero exit status. A failed
prerequisite blocks dependent cases; it cannot make them pass by skipping assertions.

`careonroad-workflows.postman_collection.json` contains actual HTTP request examples
and status assertions from the run, with secrets replaced by variables. Fill tokens
locally and use fresh fixture IDs. The Node runner executes business assertions,
concurrency, controlled time and provider fault injection that a request collection
alone cannot reproduce. Never point a worker collection at a production database.

Physical Android/iOS receipt, permission/background/offline/client navigation,
real bank settlement, process-kill recovery and legacy pre-migration data require
their own evidence. Such cases remain explicitly BLOCKED when the required fixture,
device or external-system observer is absent; simulated success does not prove them.
The catalogue is a bounded acceptance matrix, not a claim that every possible
input, timing interleaving or mobile OS behavior has been exhausted.

Sources: [maintenance](../../apps/api/MAINTENANCE-WORKFLOW.md),
[booking/reminders](../../apps/api/MAINTENANCE-NOTIFICATIONS.md),
[rescue](../../apps/api/RESCUE-WORKFLOW.md),
[payOS](https://payos.vn/docs/api/),
[FCM errors](https://firebase.google.com/docs/cloud-messaging/error-codes).
