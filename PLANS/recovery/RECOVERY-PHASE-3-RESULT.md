# Recovery Phase 3 — Expo SDK 52 alignment and mobile linting

## Completed changes

- Pinned the Expo-managed native packages required by the recovery plan:
  `@expo/vector-icons` `~14.0.4`, `@react-native-async-storage/async-storage`
  `1.23.1`, and `react-native-gesture-handler` `~2.20.2`.
- Kept the existing direct `react-native-reanimated` `~3.16.1` dependency and
  confirmed that no `react-native-worklets` package is present in the mobile
  lockfile.
- Added direct SDK 52 tooling dependencies: `babel-preset-expo` `~12.0.12`,
  `eslint` `^8.57.1`, and `eslint-config-expo` `~8.0.1`.
- Added `react-dom` `18.3.1` because this app exposes the existing Expo web
  command and its React version must stay in the React 18 mobile lane.
- Replaced the raw ESLint script with `expo lint` and added the SDK 52 legacy
  ESLint configuration in `apps/mobile/.eslintrc.js`.
- Regenerated only `apps/mobile/pnpm-lock.yaml` and preserved the separate
  mobile installation boundary created in Phase 1.

## Validation

| Gate | Result |
|---|---|
| Mobile frozen install | Pass |
| `pnpm --dir apps/mobile exec expo install --check` | Pass: `Dependencies are up to date` |
| `pnpm --dir apps/mobile peers check` | Pass: no peer dependency issues |
| `pnpm --dir apps/mobile typecheck` | Pass |
| `pnpm run lint:mobile` | Pass; dispatches through `expo lint`, with 21 unused-symbol warnings and no errors |
| Resolved native graph | React `18.3.1`, React DOM `18.3.1`, React Native `0.76.9`, Reanimated `3.16.7` |
| Required SDK package resolutions | Vector Icons `14.0.4`, Async Storage `1.23.1`, Gesture Handler `2.20.2` |
| `react-native-worklets` in mobile lockfile | Absent |

## Known non-blocking note

The SDK 52-compatible ESLint 8 package is deprecated upstream. This is an
expected compatibility trade-off for the pinned Expo 52 lane, not a dependency
or runtime failure. Upgrading it would require the later Expo/React Native
upgrade phase, not an isolated lint-tool upgrade.

Lint also reports 21 pre-existing unused-import/unused-variable warnings across
mobile UI files. They do not block the command and are not changed in this
dependency-recovery phase; clean them as a focused code-quality task rather
than mixing them with the Metro recovery.

## Deferred to Phase 4

The custom Metro resolver and NativeWind configuration remain untouched.
Android export/runtime validation therefore remains the Phase 4 gate; Phase 3
does not claim that a release bundle has been produced.

## Gate decision

Phase 3 is complete. The mobile manifest now passes Expo's SDK 52 compatibility
check with a clean peer graph, and its lint/typecheck commands are operational.
It is safe to proceed to Phase 4. No commit or push was created.
