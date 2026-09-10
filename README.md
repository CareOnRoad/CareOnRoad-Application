# CareOnRoad

CareOnRoad is a pnpm monorepo for the rider mobile experience, the web
experience, and the complete backend/API service.

## Workspace layout

```text
apps/
  api/      Next.js API service, chatbot and local ONNX ASR
  mobile/   rider-oriented Next.js application
  web/      web Next.js application
packages/   shared package workspaces
supabase/   authoritative PostgreSQL migrations
specs/      Spec Kit feature specifications and plans
```

The backend formerly developed in `demo_AI` now lives in `apps/api`. Continue
backend fixes and feature work in this repository; the old repository is no
longer the intended source of truth after migration.

The API is present and independently runnable. The existing mobile and web
frontends have not been rewired to consume every migrated endpoint as part of
this backend migration.

## Local setup

Run commands from the repository root on Windows:

```powershell
pnpm.cmd install
Copy-Item apps/api/.env.example apps/api/.env.local
pnpm.cmd run dev:api
```

Do not commit secrets. Use only test/development Supabase credentials and review
migration state before applying `supabase/migrations`.

The applications can be started separately:

```powershell
pnpm.cmd run dev:api
pnpm.cmd run dev:mobile
pnpm.cmd run dev:web
```

## Checks

```powershell
pnpm.cmd run typecheck
pnpm.cmd run lint
pnpm.cmd run lint:web
pnpm.cmd run test
pnpm.cmd run build
pnpm.cmd run asr:smoke
```

PostgreSQL integration tests require `TEST_DATABASE_URL` and must be requested
explicitly with `pnpm.cmd run test:db` or `pnpm.cmd run test:full`.

## Backend assets and documentation

- Backend details and environment variables: `apps/api/README.md`
- Local Vietnamese ASR models: `apps/api/models`
- Database migrations: `supabase/migrations`
- Spec Kit artifacts: `specs` and `.specify`
- Repository guidance: `AGENTS.md`

## Deployment

Configure each deployable application as a separate project with the relevant
app root. The root `vercel.json` predates the monorepo migration and must be
reviewed before deployment; this migration does not deploy or change a remote
database.
