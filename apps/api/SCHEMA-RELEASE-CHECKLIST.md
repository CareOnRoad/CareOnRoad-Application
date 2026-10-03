# Schema preflight and database test setup

Run these commands from the repository root. The current API requires migration
`202606250046_dispatch_radius_policy_bounds.sql`, including schema 035 columns,
validated constraints, indexes, enabled triggers, `btree_gist`, and the narrowed
mechanic-role trigger needed for historical rating updates after revoke and the
location guard for new requests, dispatch episode/retry constraints, assignment
source/provenance and distance snapshot, append-only supervision, and guarded
canceled/abandoned delivery with validated enum labels. Migrations 040 and 042
are enum-only; commit them in order before command usage from 041 and 043.
Migration 044 adds enabled reminder ownership and dashboard indexes; 045 adds exact four-key configuration constraints/history and immutable dispatch policy snapshots. Only the Docker test instance has applied these migrations; no production rollout is performed by the local batch. See [Batch 13/15](./ADMIN-REMINDER-DASHBOARD-CONFIGURATION.md).

Migration 046 replaces the legacy fixed-radius CHECK with 1,000–100,000 meter
bounds. Runtime readiness verifies this constraint shape; require 046 before
enabling configurable radius policies. Ranking and SQL use nearest-meter values.
See [admin recovery](./ADMIN-RECOVERY-OPERATIONS.md) for Batch 10–12 contracts.
See [profile/lists/admin dispatch](./PROFILE-LISTS-ADMIN-DISPATCH.md) and
[scheduled visits](./SCHEDULED-FULFILLMENT.md)
for consumer compatibility and reviewed legacy reservation repair.

## Before release

```powershell
pnpm.cmd run preflight:schema
if ($LASTEXITCODE -ne 0) { throw 'Backend schema is not ready for release.' }
```

This is a **read-only gate**, not a migration command. It verifies the application
database using a read-only transaction and a five-second SQL statement timeout.
Exit code 1 blocks release. A successful connection or local build alone does not
confirm schema compatibility. Run this gate against the target database before
the deployment step in the hosting platform; this repository has no versioned
deployment pipeline that automatically deploys the API.

`GET /api/v1/internal/health/ready` uses the same schema-object probe. Missing or
incompatible objects return HTTP 503 with a redacted `database: down` check.
Liveness remains independent of the database. Readiness checks runtime objects;
the release CLI additionally verifies every migration version present in source
has been recorded in Supabase migration history.

For a bounded data-repair inventory:

```powershell
pnpm.cmd run preflight:schema --inventory
```

The inventory never repairs data. It returns counts and at most 100 hashed IDs
per group, without names, phone numbers, addresses, provider payloads or raw IDs.
Reservation inventory is explicitly incomplete until the required columns exist.
Review actual target IDs and financial commitments separately before any future
repair. Keep execution evidence in the ignored `apps/api/audit/batch-00/` folder.

## Local Supabase through Docker (no hosted project required)

Batch 00 now uses an independent local PostgreSQL 17 + Supabase Auth instance,
project ID `careonroad-batch00-test`, database port 54322. It does not use the
production database or consume a hosted Free project. Docker must keep running.
The CLI is already installed in this workspace; no upgrade or new dependency is
needed. The remaining local services are excluded because these integration tests
use PostgreSQL and Auth fixtures directly.

The instance and private test configuration are already set up on this machine.
For another checkout, perform steps 1–3 once; for this checkout, use step 4.

1. Create an unlinked local work directory and copy the source migrations:

   ```powershell
   $batch0Local = Join-Path (Get-Location) 'apps/api/audit/batch-00/supabase-local'
   New-Item -ItemType Directory -Path $batch0Local -Force | Out-Null
   node apps/api/node_modules/supabase/dist/supabase.js init --workdir $batch0Local
   $batch0Migrations = Join-Path $batch0Local 'supabase/migrations'
   New-Item -ItemType Directory -Path $batch0Migrations -Force | Out-Null
   Get-ChildItem -LiteralPath './supabase/migrations' -File -Filter '*.sql' |
     Copy-Item -Destination $batch0Migrations
   ```

   Edit `supabase/config.toml` inside this local work directory: set
   `project_id = "careonroad-batch00-test"` and, under `[db.seed]`, set
   `enabled = false`. Keep `[db].port = 54322`. Do not link this directory to a
   hosted project. Only one team member needs the cloud project; each developer
   can have their own Docker instance.

2. Start the local DB/Auth services, saving CLI output locally:

   ```powershell
   node apps/api/node_modules/supabase/dist/supabase.js start --workdir $batch0Local -x realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor *> (Join-Path $batch0Local 'start.log')
   if ($LASTEXITCODE -ne 0) { throw 'Local Supabase start failed; inspect the private local log.' }
   ```

   **The first start applies the copied migrations automatically to this new
   local instance.** It starts with no application data and does not seed mock
   accounts. This is not a migration preview or a production rollout. On later
   source changes, refresh the migration copies, then inspect
   `migration list --local` and `db push --local --dry-run` before applying the
   pending migrations with `db push --local`, always with this work directory.

3. Capture the local connection into the ignored test-only file, without
   displaying credentials:

   ```powershell
   $batch0Status = node apps/api/node_modules/supabase/dist/supabase.js status --workdir $batch0Local -o json 2> (Join-Path $batch0Local 'status.log') | Out-String | ConvertFrom-Json
   $batch0Uri = [uri] $batch0Status.DB_URL
   if ($batch0Uri.Host -notin @('127.0.0.1', 'localhost', '[::1]') -or $batch0Uri.Port -ne 54322) {
     throw 'Expected the separate Docker test instance on local port 54322.'
   }
   @("TEST_DATABASE_URL=""$($batch0Status.DB_URL)""", 'TEST_DATABASE_CONFIRMED=true') |
     Set-Content -LiteralPath 'apps/api/.env.test.local' -Encoding utf8
   Remove-Variable batch0Status, batch0Uri
   ```

   `.env.test.local` is loaded in test mode. Keep application settings in
   `.env.local`; do not copy local Auth keys into production settings or commit
   either file. Confirmation is allowed because this is a separate Docker DB
   instance; it never bypasses the same-application-database guard.

4. Validate or resume normal work:

   ```powershell
   $batch0Local = Join-Path (Get-Location) 'apps/api/audit/batch-00/supabase-local'
   node apps/api/node_modules/supabase/dist/supabase.js migration list --local --workdir $batch0Local
   node apps/api/node_modules/supabase/dist/supabase.js db push --local --dry-run --workdir $batch0Local
   pnpm.cmd run preflight:test-db
   pnpm.cmd run test:db
   ```

   After restarting Docker, run the start command in step 2 with the same work
   directory before the tests. To stop this local instance while preserving its
   data, use:

   ```powershell
   node apps/api/node_modules/supabase/dist/supabase.js stop --workdir $batch0Local
   ```

The DB suite creates isolated `careonroad_test_*` schemas and removes its own
temporary Auth fixtures. Cleanup can reset append-only tables only inside that
schema; guard disable/truncate/restore runs as one atomic PostgreSQL statement,
including rollback on failure. It cannot truncate public tables or disable
production triggers. Local test success does not confirm real payment/push/media
providers, deployed HTTP clients, or production schema readiness.

## Dedicated hosted test database (optional alternative)

Configure `TEST_DATABASE_URL` in the ignored `apps/api/.env.test.local` for a
separate test database/project.
For a confirmed hosted Supabase test project, also set
`TEST_DATABASE_CONFIRMED=true`. Never copy production credentials into that setting
as a shortcut. Do not paste secrets into reports, commits or chat.

```powershell
pnpm.cmd run preflight:test-db
pnpm.cmd run test:db
```

The CLI and integration suite share the database-isolation guard. Explicit test
confirmation does not allow the application database. Direct and pooler URLs for
one Supabase project are recognized as the same target. Localhost aliases, default
ports and URL-encoded database names are normalized before comparison.

On the **test/development project only**, inspect migration history, preview the
pending changes and apply them using the linked Supabase CLI:

```powershell
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
pnpm.cmd run preflight:test-db
pnpm.cmd run test:db src/server/db/__tests__/backend-schema.integration.test.ts
pnpm.cmd run test:db src/server/repositories/postgres/__tests__/maintenance-reservations.integration.test.ts
```

Confirm the CLI is linked to the test project before executing these commands.
Check extension permissions, legacy maintenance schedules and the new exclusion
constraint in the preview. Do not edit an applied migration or reset production.
Production migration rollout needs its own reviewed deployment authorization.

The schema integration smoke applies source migrations to an isolated schema on
the dedicated test database, checks actual objects, executes assignment reservation
and notification lease repository queries, and proves a missing column is rejected.
The existing maintenance reservation integration test exercises real acceptance
and exclusion-concurrency behavior. Both remain excluded from normal unit tests.

## Local verification

```powershell
pnpm.cmd install --frozen-lockfile --offline --ignore-scripts
pnpm.cmd test
pnpm.cmd run test:audit
pnpm.cmd run typecheck
pnpm.cmd run lint
pnpm.cmd run build
```

The frozen install only restores already-declared dependencies and does not change
versions. Root workspace includes API/web/shared packages; mobile has its own
installation boundary. `test:audit` uses the existing Node test runner directly,
so it does not depend on resolving a bare `vitest` command through the shell.
The original B01–B12 audit remains historical evidence; all 14 role-flow
regressions now pass and also run in the default unit suite. See the batch report.
