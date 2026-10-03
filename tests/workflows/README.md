# HTTP workflow acceptance tests

Run from the repository root with Node 24+ and installed workspace dependencies:

```powershell
node tests/workflows/run.mjs --list
node tests/workflows/run.mjs
node tests/workflows/check-provider-contract.mjs
node tests/workflows/check-clock.cjs
node tests/workflows/run.mjs --live-payment-smoke
node tests/workflows/run.mjs --missing-fcm-smoke
node tests/workflows/run.mjs --payment-crash-smoke
node tests/workflows/run.mjs --push-crash-smoke
node tests/workflows/run.mjs --fencing-smoke
node tests/workflows/run.mjs --legacy-smoke
node tests/workflows/check-artifacts.mjs
```

Each run copies API source/config unchanged into
that run's ignored report folder, reuses installed dependencies via a junction,
and gives each Next process its own build output. For independent groups running
at the same time, use `--port=3211` and a different port per process. Schemas,
Auth fixtures, clocks and provider instances also remain independent.

This suite calls the Next API through HTTP, authenticates genuine Supabase users,
and checks persistent PostgreSQL results. It does not import application services,
repositories, handlers, or existing unit-test expectations. The oracle comes from
published business workflows/API contracts and official payOS/FCM wire contracts.
The runner saves the case catalogue and SHA-256 hashes **before execution**.
The original black-box baseline predates reading backend implementation. Backend
fixes are diagnosed afterward against the frozen expectations; raw baseline
reports remain intact. Later runs also save Git HEAD and an API-diff SHA-256.

The suite requires `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` from local environment files. Credentials, JWTs, device
tokens and webhook secrets are never written into reports or the collection.

Each run creates a fresh private `cor_http_*` schema, installs the repository's
unchanged migrations there, and launches a private API on port 3210. Database
search_path is configured per connection. An isolation check must succeed before
workers are allowed to run. Existing business records in `public` are not modified.
Fresh Auth fixture accounts are locked after the run. The private schema remains
for read-only investigation; results list its name and owned fixture IDs.

payOS and FCM responses are controlled at the network boundary of this API process.
The suite uses no real bank transfer, and no real push provider. Business time is
controlled for expiry/snooze/retry tests; JWT cryptographic verification still uses
real wall time. Public JWKS are downloaded from Supabase and cached; fixture JWTs
are refreshed according to the Auth response TTL. SQL prepares the private administrator role and reads evidence;
it never marks an order paid or manufactures request/assignment workflow state.

`--live-payment-smoke` uses the supplied payOS merchant configuration to create,
read and cancel a real payment link after an HTTP maintenance workflow. It checks
the provider independently before/after cancellation and never transfers money.
It does not simulate a successful webhook against the real provider. A paid bank
transaction and physical phone delivery still require the procedures in
[MANUAL-CASES.md](MANUAL-CASES.md).
The live fixture initializes only its private order-code sequence with a random
code in the schema's range to avoid the default merchant order namespace.

Crash variants stop only their owned copied API process at a provider response
barrier, verify the API is unreachable, and restart with the same private schema
and fixture configuration. Payment recovery checks one durable logical link/order
and zero credited funds. Push recovery observes provider acceptance before receipt
completion, then expired-lease reclaim; transport can repeat with the same
notification_id while the inbox stays singular. These use simulated providers
and a two-connection API pool; they do not prove bank settlement, physical receipt,
or stale-worker completion after an old process resumes. `--observe-db-errors`
adds a metadata-only socket observer for PostgreSQL error codes, with no query or
response changes.
The Windows fencing variant uses two copied API processes. Native pause/resume
is restricted to the verified Next worker child of the runner-owned API CLI;
cleanup resumes it before termination. A second process reclaims expired leases,
then the old execution resumes and must preserve terminal records. The same case
checks token rotation while an old UNREGISTERED response is held at the provider
boundary. It uses a two-connection API pool and a configured 30-second FCM deadline.
The old success must resume within that deadline; slower takeover is BLOCKED,
so a stale timeout cannot masquerade as proof of stale-success fencing.

The legacy variant reconstructs the repository API at commit5307fcc in its own
output folder and applies migrations001–033. That API creates approved standard
quotes, an already-paid order and a request without coordinates through HTTP.
After stopping it, the runner applies034/035 only to its private schema and
launches the current source in another output folder. Compatibility assertions
run against that upgraded API; no SQL manufactures workflow history. Existing
installed runtime dependencies are reused and both source snapshots are retained.

| Group | Coverage |
|---|---|
| SEC | Missing/invalid JWT, protected routes, worker secret cannot be replaced by user/admin JWT, error redaction |
| MNT | Input/ownership/idempotency, automatic matching, reservation confirmation, state synchronization and guards, fixed labor, rejected/revised/superseded/expired quotes, approved/rejected cumulative additions, quote-bound checklist, no-part and part E2E variants, future appointments, no available mechanic, completion and review |
| PAY | Pay-after-service only, immutable server amount, order ownership/idempotency/concurrency, cancel/recreate, bad/tampered/unknown webhooks, under/over/currency/link mismatch, duplicate/concurrent success, late payment, provider-verified admin resolution, missing webhook reconciliation, provider outage |
| NTF | Due/recurring/disabled/snoozed/archived reminders, reminder-to-maintenance E2E, owner-only inbox/navigation/pagination/unread state, device rotation/revocation, FCM typed invalid token/permanent/transient/quota errors, Retry-After, mixed devices, concurrent workers, dead letters, maintenance and both rescue payment flows |
| EXT | Competing offer acceptance/cancellation, eligibility by skills/radius/freshness/status, ISO timezone and coordinate boundaries, 480-minute/adjacent buffers, preparation notice, unsuccessful provider events, forged order fields, reconcile underpayment and close_unpaid |

`test-cases.json` contains every case with its explicit expected result.
`TEST-CASES.md` is the readable catalogue. `LATEST.md` links the most recent result;
each immutable `reports/<run>/` contains the frozen catalogue, HTTP trace, outcomes,
cleanup result and report. FAIL and BLOCKED both cause nonzero exit status. A failed
prerequisite blocks dependent cases; it cannot make them pass by skipping assertions.

Use `--extra-only` for independent EXT cases, or `--only=EXT-001,EXT-002` for
selected IDs. Selected dependent main cases still require their earlier fixtures;
missing prerequisites remain BLOCKED. See [oracle revisions](ORACLE-REVISIONS.md)
for initialization failures and documented harness corrections. PostgreSQL
extensions are database-wide objects; do not drop retained schemas with CASCADE
without checking extension and external dependency ownership.

`careonroad-workflows.postman_collection.json` contains actual HTTP request examples
and status assertions from the run, with secrets replaced by variables. Fill tokens
locally and use fresh fixture IDs. The Node runner executes business assertions,
concurrency, controlled time and provider fault injection that a request collection
alone cannot reproduce. Never point a worker collection at a production database.

Physical Android/iOS receipt, permission/background/offline/client navigation,
real bank settlement require their own evidence.
Such cases remain explicitly BLOCKED when the required fixture,
device or external-system observer is absent; simulated success does not prove them.
The catalogue is a bounded acceptance matrix, not a claim that every possible
input, timing interleaving or mobile OS behavior has been exhausted.

Sources: [maintenance](../../apps/api/MAINTENANCE-WORKFLOW.md),
[booking/reminders](../../apps/api/MAINTENANCE-NOTIFICATIONS.md),
[rescue](../../apps/api/RESCUE-WORKFLOW.md),
[payOS](https://payos.vn/docs/api/),
[FCM errors](https://firebase.google.com/docs/cloud-messaging/error-codes).
