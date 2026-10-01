# Recovery Phase 2 — Root commands and manifest consistency

## Completed changes

- Changed `dev:mobile` to run `pnpm --dir apps/mobile start`.
- Defined `build:mobile` as Android bundle verification through `pnpm --dir apps/mobile export:android`.
- Added `export:android` in the mobile manifest as `expo export --platform android --output-dir dist`.
- Added root `lint:mobile` and `typecheck:mobile` commands targeting the mobile boundary.
- Added `apps/mobile/dist/` to `.gitignore` because Android export output is generated verification output.
- Changed API `@next/eslint-plugin-next` and `eslint-config-next` from 16.x to `^15.5.25`, matching the API Next 15 lane.
- Regenerated the root lockfile.

## Validation

| Gate | Result |
|---|---|
| Root frozen install | Pass |
| Mobile frozen install | Pass |
| `pnpm run typecheck:mobile` | Pass |
| `pnpm run lint:api` | Pass |
| `pnpm run dev:mobile -- --help` | Pass; dispatches to Expo start |
| `pnpm run build:mobile -- --help` | Pass; dispatches to Android Expo export |
| API resolved versions | `next`, `@next/eslint-plugin-next`, and `eslint-config-next` are all `15.5.25` |

## Deferred to Phase 3

`pnpm run lint:mobile` dispatches correctly but exits with `eslint is not recognized`. The mobile boundary intentionally does not yet declare the SDK 52 ESLint tooling. Phase 3 owns adding and configuring that tooling alongside the Expo SDK 52 package alignment.

The three `expo install --check` mismatches recorded in Phase 1 remain deferred to Phase 3.

## Gate decision

Phase 2 is complete. Root scripts no longer target nonexistent mobile `dev`/`build` scripts, and API no longer has a Next 15 / Next ESLint 16 major mismatch. It is safe to proceed to Phase 3. No commit or push was created.
