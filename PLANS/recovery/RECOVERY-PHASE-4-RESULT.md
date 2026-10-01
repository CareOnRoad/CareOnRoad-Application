# Recovery Phase 4 — Metro and NativeWind recovery

## Completed changes

- Replaced the custom Metro resolver with the Expo-supported base configuration:
  `getDefaultConfig(__dirname)` wrapped only by `withNativeWind`.
- Removed all manual workspace watch folders, root node-module fallbacks,
  symlink settings, app blocklists, React realpath resolution, and `.pnpm`
  store coupling from `metro.config.js`.
- Corrected the NativeWind input from the TypeScript Tailwind configuration to
  the actual CSS entry point, `./app/global.css`.
- Imported `./global.css` in the Expo Router root layout and added the
  `nativewind/babel` preset alongside `babel-preset-expo`.
- Reworked `test-bundle.cjs` to delegate to Expo's supported Android export
  command instead of calling Metro's internal API or a hard-coded pnpm-store
  path. Its Windows launcher uses `cmd.exe` explicitly and no longer emits the
  Node `shell: true` warning.
- During the first Android export, Expo Router failed because SDK 52's shipped
  `expo-router@4.0.22` imports but does not declare `query-string`. With user
  approval, added the reproducible direct dependency `query-string@7.1.3` and
  regenerated the mobile lockfile.

## Validation

| Gate | Result |
|---|---|
| Mobile frozen install | Pass |
| `expo install --check` | Pass: dependencies are up to date |
| Mobile peer check | Pass: no peer dependency issues |
| Mobile typecheck | Pass |
| Mobile lint | Pass: 0 errors, 21 existing unused-symbol warnings |
| Direct `expo export --platform android` | Pass: 2,885 modules; Hermes bundle 5.83 MB |
| Legacy `node test-bundle.cjs` wrapper | Pass; delegates to the same Expo export gate |
| `expo start --clear --offline` | Pass: cache rebuilt and Metro served at `http://localhost:8081`; process then stopped intentionally |
| Mobile runtime graph | React `18.3.1`, React Native `0.76.9`, Reanimated `3.16.7`, Query String `7.1.3` |
| Metro config audit | Pass: no `.pnpm`, manual `watchFolders`, `nodeModulesPaths`, custom `resolveRequest`, `realpath`, or `blockList` rules |
| NativeWind wiring audit | Pass: CSS input, root CSS import, and Babel preset all present |
| Git diff whitespace check | Pass |

## Risks and follow-up record

- The 21 lint warnings first recorded in Phase 3 remain. They are unused
  imports/variables, not bundle failures, but can hide incomplete UI behavior;
  clean them before release in a focused code-quality change.
- ESLint 8 is deprecated upstream but is the compatible lint lane for Expo SDK
  52. Upgrade it only with a coordinated Expo/React Native upgrade.
- The Android bundle proves module resolution and NativeWind CSS transformation,
  but this environment has not launched the app on an Android emulator or
  physical device. Visual styling, Fast Refresh, role flows, and device-level
  Invalid Hook Call checks remain explicit Phase 6 validation work.

## Gate decision

Phase 4 configuration recovery is complete and the supported Android bundle
path is reproducible. It is safe to proceed to Phase 5, which stabilizes and
reviews the two generated lockfiles. No commit or push was created.
