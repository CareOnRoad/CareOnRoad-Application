# Recovery Phase 6 — Verification matrix

## Passed verification gates

| Area | Gate | Result |
|---|---|---|
| Root | Frozen install | Pass; lockfile hash unchanged |
| Mobile | Frozen install and peer check | Pass; lockfile hash unchanged and no peer issues |
| Mobile | React/RN graph | Pass; exactly one React `18.3.1` and one React Native `0.76.9` resolve in the mobile boundary |
| Mobile | Expo dependency compatibility | Pass: `expo install --check` reports dependencies up to date |
| Mobile | Typecheck and lint | Typecheck pass; lint has 0 errors and 21 existing unused-symbol warnings |
| Mobile | Android export | Pass; 2,885 modules, 23 assets, 5.83 MB Hermes bundle |
| Mobile | Metro clean-start | Pass in offline mode; cache rebuilt and server listened on `localhost:8081` before intentional shutdown |
| API | Typecheck and lint | Pass |
| API | Unit/static/route suite | Pass: 164 files, 512 tests |
| API | Production build | Pass; Next `15.5.25`, 38 static-generation steps complete |
| Web | Lint and production build | Pass; Next `16.3.4`, four static pages generated |
| Root commands | Mobile command routing | Pass; all root mobile scripts use `pnpm --dir apps/mobile`, not a root workspace filter |
| Reproducibility | Repeated frozen installs | Pass; neither lockfile changed |
| Git | Diff whitespace and branch divergence | Pass; no whitespace error and `HEAD` is `0/0` commits from `origin/mono/mobile/break` |

## Expo Doctor finding requiring an explicit native-build decision

`pnpm exec expo-doctor` is not supplied by the Expo package itself, so the
official temporary command `pnpm dlx expo-doctor@latest` was used without
changing a manifest or lockfile. It passed 17 of 18 checks.

The remaining check warns that committed native Android project files coexist
with Prebuild-controlled fields in `app.json`. It does **not** show dependency
or Metro breakage. A read-only comparison confirms the current Android package
ID, app name, portrait orientation, splash color, and requested camera/location
permissions match `app.json`.

The risk is forward-looking: changing `orientation`, `userInterfaceStyle`,
`splash`, platform configuration, or plugins in `app.json` will not update the
committed native projects unless the team runs and reviews `expo prebuild` (or
manually maintains the corresponding native changes). The check must not be
silenced until the team records which workflow owns native configuration.

## Environment-limited runtime checks

No `adb` executable/device was available on this host. Therefore, Android app
launch, role selection, rider/mechanic tab interaction, Fast Refresh, and
visual inspection of NativeWind styles could not be performed here. The full
Android JavaScript bundle and Metro module-resolution path pass, so there is no
observed Invalid Hook Call, SHA-1, or module-resolution error in the supported
automated bundle gate.

## Carried release risks

- The 21 mobile lint warnings for unused imports/variables remain to be cleaned
  before release because they can conceal unfinished UI behavior.
- ESLint 8 is deprecated upstream but remains the compatible Expo SDK 52 lint
  lane; upgrade it only in a coordinated Expo/React Native migration.

## Gate decision

All dependency-boundary, bundle, API, and web automated gates pass. Phase 7
documentation can proceed, but the native configuration ownership decision and
an emulator/device smoke test remain required before declaring the recovery
release-ready. No commit or push was created.
