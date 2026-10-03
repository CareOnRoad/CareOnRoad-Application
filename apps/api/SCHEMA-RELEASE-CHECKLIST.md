# Schema preflight and database test setup

Run these commands from the repository root. The current API requires migration
`202606250035_maintenance_reservations_notification_leases.sql` and its actual
columns, validated constraints, indexes, enabled triggers, and `btree_gist` extension.

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

## Dedicated test database

Configure `TEST_DATABASE_URL` locally for a separate test database/project.
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
Audit failures for B02–B12 remain expected until their implementation batches;
they are recorded separately from the normal regression suite.
