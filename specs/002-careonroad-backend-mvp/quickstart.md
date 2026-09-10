# Quickstart: Validate CareOnRoad Backend MVP

This guide describes validation after implementation. It does not replace the
API contract or data model.

## Current Patch Status

- Patches 1-5 are complete through T068 plus T112-T113.
- Payment is implemented separately in feature 005 as a backend-only
  payOS/VietQR order, webhook, and reconcile flow.
- Patch 7A reminders are complete through T087 with
  `202606250011_reminders.sql`.
- Patch 7B notification persistence/outbox delivery is complete through T096.
- Patch 8 compatible chatbot persistence is complete through T105.
- Patch 9 hardening is complete through T118 (T106-T111 and T114-T118).
- Apply and verify migrations 008 through 014 on hosted/dev before
  enabling those APIs against hosted/dev application data.

## Prerequisites

- Existing DEMO_AI dependencies installed.
- Approved constitution amendment for feature 002.
- Docker-compatible local environment for Supabase CLI, or a dedicated test
  PostgreSQL instance with required extensions.
- Backend-only environment variables configured with test values.
- No real Gemini, OpenRouter, payment provider, SMS, push, or ONNX calls in
  automated tests; payment provider behavior is covered with fixtures/mocks.

The linked Supabase hosted development database is available through the
session pooler. Database integration tests create a unique
`careonroad_test_*` schema, run migration/repository checks there, and remove
the schema and temporary Auth fixture afterward. T016 passed through this flow
on 2026-06-25.

Expected new configuration categories:

```env
DATABASE_URL=
TEST_DATABASE_URL=
CHATBOT_PERSISTENCE_MODE=postgres
SUPABASE_URL=
SUPABASE_JWT_ISSUER=
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWKS_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SEED_USER_PASSWORD=
PAYMENT_PROVIDER=
PAYMENT_WEBHOOK_SECRET=
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
PAYOS_WEBHOOK_SECRET=
INTERNAL_WORKER_SECRET=
```

Do not add `NEXT_PUBLIC_` prefixes to database, service-role, payment, or worker
secrets.

## Initialize Database

Preferred local flow:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset
```

Alternative test database flow:

1. Create an empty PostgreSQL database.
2. Enable extensions required by migrations, including PostGIS.
3. Apply `supabase/migrations/*.sql` in version order.
4. Seed test users/roles through test helpers, not committed credentials.

Authoritative migration sequence:

1. `202606250001_enable_extensions.sql`
2. `202606250002_outbox_audit_idempotency.sql`
3. `202606250003_rls_foundation.sql`
4. `202606250004_identity_and_roles.sql`
5. `202606250005_user_devices.sql`
6. `202606250006_motorcycles_and_mechanics.sql`
7. `202606250007_service_requests.sql`
8. `202606250008_dispatch_candidates.sql`
9. `202606250009_assignments.sql`
10. `202606250010_diagnoses_and_quotes.sql`
11. `202606250011_reminders.sql`
12. `202606250012_notifications_outbox_audit.sql`
13. `202606250013_chatbot_persistence.sql`
14. `202606250014_indexes_constraints_rls.sql`
15. `202606250015_admin_user_management.sql`
16. `202606250016_admin_mechanic_management.sql`
17. `202606250017_assignment_eta_metadata.sql`
18. `202606250018_assignment_field_media.sql`
19. `202606250019_assignment_completion_checklists.sql`
20. `202606250020_payments.sql`

Payment schema lives in `202606250020_payments.sql`; quote approval still stops
at `awaiting_payment`, and service work can move to `in_progress` only after a
verified succeeded payment.

## Apply Migrations and Seed Hosted Development

This flow is for a disposable hosted test/development project, not production.
Link the project once if `supabase/.temp/project-ref` is absent:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref <project-ref>
```

Inspect the remote migration history, preview pending changes, and apply all
migrations through `202606250020`:

```powershell
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

If the hosted schema was changed manually and migration history differs, stop
and inspect the mismatch. Do not mark migrations as applied with
`migration repair` unless the corresponding schema is already verified.

For the complete demo fixture, configure backend-only `DATABASE_URL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a test-only
`SEED_USER_PASSWORD` in `.env.local`, then run:

```powershell
npm.cmd run seed:mock
npm.cmd run seed:mock:verify
```

The seed creates or updates these Auth accounts:

- `rider1@gmail.com`
- `rider2@gmail.com`
- `mechanic1@gmail.com`
- `mechanic2@gmail.com`

They share `SEED_USER_PASSWORD`. Re-running the seed resets their passwords and
upserts fixed-ID fixtures. Expected verification counts are 4 application
users, 5 motorcycles, 10 service requests, 5 dispatch candidates, 3
assignments, 4 quotes, 4 reminder rules, 4 notifications, and 2 chatbot
sessions.

Use `npm.cmd run seed:mock:verify` for a read-only check. Never expose or commit
the database URL, service-role key, seeded password, or `.env.local`.

## Run Application Checks

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Existing chatbot/ASR tests must remain green.

### Patch 9 verification record — 2026-06-30

- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS.
- `npm.cmd test`: PASS — 67 test files and 262 tests passed; 13 database test
  files and 38 tests skipped in the environment-independent run.
- `npm.cmd run build`: PASS — optimized Next.js production build completed.
- Configured `TEST_DATABASE_URL` Patch 9 suite: PASS — 5 files and 6 tests
  passed, covering clean reset/sequential migration upgrade, 50-profile
  dispatch with five contested accept pairs, 20-operation auth/CRUD, two-peer
  processing of 20 leased outbox events, and 20-request mocked chatbot latency.
- These smoke results are local regression evidence only; they are not
  production p95, capacity, or readiness claims.

## Validate Authentication and Ownership

1. Create test JWTs or mock the token verifier in route tests.
2. Call `POST /api/v1/auth/profile`.
3. Create a motorcycle for rider A.
4. Read it as rider A: expect `200`.
5. Read it as rider B: expect controlled `404` or `403` according to the final
   anti-enumeration policy.

Expected outcome:

- JWT claims are validated.
- Application roles come from the database.
- Ownership checks happen in services/repositories.

## Validate Service Request Transaction

1. Validate the exact service-type input matrix:
   - emergency rescue requires pickup location and prohibits schedule;
   - mobile repair requires location/address and prohibits schedule;
   - at-home service requires address and a future schedule;
   - periodic maintenance requires schedule or reminder context;
   - other requires location or schedule for the selected workflow.
2. Create an emergency, mobile-repair, or at-home-service request with
   `X-Idempotency-Key`.
3. Retry the identical request with the same key.
4. Verify one service request exists.
5. Add request media metadata and verify ownership, sanitized audit/outbox, and
   that raw media is not persisted.
6. Verify initial status history, outbox, audit, and completed idempotency rows.
7. Retry the key with a different body and expect conflict.
8. Verify `request_code` matches
   `COR-{EMR|MOB|HOME|MNT|OTH}-{YYYYMMDD}-{DAILY_SEQUENCE}`.
9. Verify the date uses Asia/Ho_Chi_Minh and concurrent generation produces
   unique monotonic sequences for each service prefix/date.

## Validate Concurrent Dispatch Acceptance

1. Seed an unassigned request and two eligible mechanics.
2. Verify deterministic candidate ordering: online/accepting, matching skill,
   no active conflict, distance, rating, workload, availability update time,
   then mechanic id ascending.
3. Verify radius steps `[2, 5, 8, 12]` km, batch size 10, 60-second offer TTL,
   maximum four rounds, and 360-second total wait.
4. Create one active dispatch round with offers for both mechanics.
5. Execute both accept operations concurrently.
6. Verify:
   - one response succeeds;
   - one response is `409`;
   - one active assignment exists;
   - competing offers are canceled/expired;
   - request state is assigned;
   - outbox and audit rows exist.

Repeat with one mechanic accepting two requests concurrently to validate the
active-work conflict states: `accepted`, `en_route`, `on_site`, `diagnosis`,
`quoted`, `awaiting_payment`, and `in_progress`.

## Validate Diagnosis and Quote Versioning

1. Record mechanic diagnosis for an active assignment.
2. Create quote version 1.
3. Create quote version 2.
4. Verify version 1 is superseded.
5. Attempt to approve version 1: expect `409`.
6. Approve version 2 as the owning rider.
7. Attempt to mutate version 2: expect rejection.
8. Verify totals equal server-calculated quote lines minus discount.

## Validate Payment Replay Safety

1. Configure only a mock/sandbox payment adapter with no real credentials.
2. Create a payment order from the approved quote with `X-Idempotency-Key`
   scoped by actor, endpoint, provider code, quote id, and key.
3. Replay the same payload and verify the same logical result; replay a
   different payload and expect conflict. Verify payload hash/result metadata
   retention is at least 24 hours.
4. Send a client callback claiming success and verify it cannot mark the order
   succeeded.
5. Send a verified provider fixture event.
6. Send the same event again using provider event id, then test the fallback
   provider order reference plus event type dedupe key.
7. Verify one logical transition and one unique provider event record.
8. Send an invalid-signature fixture: expect no state change.
9. Send an amount-mismatch fixture: expect `needs_review` and an audit record.
10. Verify there is no production checkout, settlement, or refund behavior.

## Run Performance Smoke Checks

- Run lightweight auth/profile and representative CRUD checks.
- Exercise pilot-scale dispatch and contested assignment behavior.
- Verify worker peer claims do not block each other.
- Compare deterministic mocked-provider chatbot latency before and after
  persistence integration.

These are regression smoke checks, not production-grade p95 benchmarks.

## Validate Reminder Deduplication

1. Create a due reminder rule.
2. Run two worker invocations concurrently.
3. Verify one `(rule_id, due_at)` occurrence.
4. Verify one notification/outbox dedupe key.
5. Simulate adapter failure and retry.
6. Verify retry metadata changes without duplicate domain records.

## Validate Outbox Lease Recovery

1. Claim an outbox item with worker A.
2. Simulate worker A terminating before completion.
3. Advance the clock beyond lease expiry.
4. Run worker B.
5. Verify worker B reclaims the item and the consumer dedupe key prevents
   duplicate logical delivery.

## Validate Audit Sanitization

Submit test metadata containing:

- fake authorization/token fields;
- fake API keys;
- raw audio-like fields;
- phone/email;
- card/bank/payment credentials;
- full chatbot text.

Verify prohibited values are absent and only safe identifiers/metadata remain.

## Validate Existing Chatbot Preservation

Run the current scenarios:

- normal Vietnamese text diagnosis;
- dangerous brake/fuel/smoke input;
- Gemini failure followed by OpenRouter;
- all providers failing into local fallback;
- local voice transcription;
- latest diagnosis restoration.

Expected outcome: feature 002 introduces no contract or behavior change to
`/api/chatbot/**`.

## Validate Chatbot Persistence Integration

1. Create a chatbot session through the existing endpoint.
2. Submit a text diagnosis.
3. Restart the application process while keeping PostgreSQL running.
4. Request the latest diagnosis using the same session id.
5. Verify the diagnosis is restored with the same public response contract.
6. Run provider-failure and dangerous-symptom scenarios again.
7. Verify local fallback, safety override, post-validation, and privacy-safe
   logging remain unchanged.
8. Verify no raw audio is stored in chatbot persistence tables.
9. Run the complete existing test suite and verify chatbot, provider, ASR,
   route, schema, retrieval, post-validation, rate-limit, logger, and view-model
   tests all remain green.

## References

- [Implementation plan](plan.md)
- [Data model](data-model.md)
- [Backend API contract](contracts/backend-api.yaml)
- [Research decisions](research.md)
