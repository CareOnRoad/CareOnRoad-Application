# CareOnRoad

CareOnRoad is a pnpm monorepo for the rider mobile experience, the web
experience, and the complete backend/API service.

## Workspace layout

```text
apps/
  api/      Next.js API service, chatbot and local ONNX ASR
  mobile/   Expo Router application for Android, iOS, and web
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

Mobile uses a separate pnpm installation boundary because Expo SDK 52 requires
the React 18 / React Native dependency lane. Install it explicitly after the
root boundary:

```powershell
pnpm.cmd --dir apps/mobile install
```

Do not commit secrets. Use only test/development Supabase credentials and review
migration state before applying `supabase/migrations`.

API and web are run from the root workspace:

```powershell
pnpm.cmd run dev:api
pnpm.cmd run dev:web
```

Run mobile commands through its own boundary:

```powershell
pnpm.cmd run dev:mobile
pnpm.cmd run lint:mobile
pnpm.cmd run typecheck:mobile
pnpm.cmd run build:mobile
```

`build:mobile` is an Android JavaScript/Hermes bundle verification command. It
does not produce an installable APK; use the Android native build workflow when
an APK or device installation is required.

## Checks

```powershell
pnpm.cmd run typecheck
pnpm.cmd run lint
pnpm.cmd run lint:web
pnpm.cmd run test
pnpm.cmd run build:api
pnpm.cmd run build:web
pnpm.cmd run typecheck:mobile
pnpm.cmd run lint:mobile
pnpm.cmd run build:mobile
pnpm.cmd run check:mobile-native-sync
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

## Dependency boundaries

| Application | Supported lane |
|---|---|
| API | Next.js 15 + React 19 |
| Web | Next.js 16 + React 19 |
| Mobile | Expo SDK 52 + React 18.3.1 + React Native 0.76.9 |

Different React versions are intentional because these applications run in
separate bundlers and installation boundaries. Do not use a repository-wide
React override to force one version across all applications.

## Native Android configuration

`apps/mobile/android` is committed and synchronized from mobile `app.json`
with controlled Expo Prebuild. When changing app name, orientation, splash,
package ID, permissions, or Expo plugins, run:

```powershell
pnpm.cmd --dir apps/mobile run prebuild:android
pnpm.cmd run check:mobile-native-sync
```

Review and commit the generated Android diff together with the `app.json`
change. See `apps/mobile/NATIVE-CONFIG-WORKFLOW.md` for the full policy and
`apps/mobile/DEVICE-SMOKE-TEST.md` for the required emulator/device release
checklist.

## Recovery merge strategy

Review the dependency recovery as focused commits/PRs: workspace and scripts,
mobile dependency alignment, Metro/NativeWind, lockfiles, then documentation.
Merge only after root and mobile frozen installs, API/web checks, mobile bundle,
native-sync check, and a device/emulator smoke test have passed.

## Deployment

Configure each deployable application as a separate project with the relevant
app root. The root `vercel.json` predates the monorepo migration and must be
reviewed before deployment; this migration does not deploy or change a remote
database.
