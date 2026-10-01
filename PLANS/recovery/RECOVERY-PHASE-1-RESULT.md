# Recovery Phase 1 — Installation boundaries

## Completed changes

- Replaced root workspace glob `apps/*` with explicit API/web entries; mobile is no longer a root workspace importer.
- Deleted the malformed nested workspace and lockfile under `apps/web`.
- Added `apps/mobile/pnpm-workspace.yaml` with package `.` and `nodeLinker: hoisted`.
- Added a mobile-local pnpm `11.22.0` declaration and generated `apps/mobile/pnpm-lock.yaml`.
- Regenerated root `pnpm-lock.yaml` for root, API, web, and framework-neutral packages only.
- Removed mobile pnpm overrides that forced incompatible Metro/worklets versions.
- Declared `react-native-reanimated ~3.16.1` directly; the generated graph resolves its compatible `3.16.7` release.

## Validation

| Gate | Result |
|---|---|
| Root frozen install | Pass (`pnpm install --frozen-lockfile --ignore-scripts`) |
| Mobile frozen install | Pass (`pnpm --dir apps/mobile install --frozen-lockfile --ignore-scripts`) |
| Root peer check | Pass |
| Mobile peer check | Pass |
| Mobile React graph | One `react@18.3.1`, one `react-native@0.76.9`, one `react-native-reanimated@3.16.7` |
| Mobile typecheck | Pass |
| API typecheck | Pass |
| Root lockfile mobile importer | Absent |
| Web nested workspace/lockfile | Absent |
| pnpm version in both boundaries | `11.22.0` |

## Deferred to Phase 3

`expo install --check` intentionally remains red because the existing caret ranges resolve packages newer than Expo SDK 52 expects:

- `@expo/vector-icons@14.1.0` instead of `~14.0.4`;
- `@react-native-async-storage/async-storage@1.24.0` instead of `1.23.1`;
- `react-native-gesture-handler@2.33.0` instead of `~2.20.2`.

These are dependency alignment changes explicitly assigned to Phase 3. They are recorded here and must not be treated as evidence that the Phase 1 boundary failed.

## Gate decision

Phase 1 is complete. It is safe to continue to Phase 2, which fixes root command contracts and manifest consistency. No commit or push was created.
