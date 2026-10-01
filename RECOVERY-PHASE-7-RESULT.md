# Recovery Phase 7 — Documentation and operational handoff

## Completed documentation and workflow changes

- Updated the root README to describe mobile as Expo Router, not Next.js.
- Documented the two deliberate dependency boundaries, the supported framework
  lanes, and the fact that React 18 mobile and React 19 API/web are intentional
  isolated runtimes.
- Documented root/mobile commands, Android bundle scope, validation gates, and
  the focused recovery merge strategy.
- Added `apps/mobile/NATIVE-CONFIG-WORKFLOW.md` for the committed-Android,
  controlled-Prebuild policy.
- Added `apps/mobile/DEVICE-SMOKE-TEST.md` with the required ADB/emulator
  prerequisites and manual release smoke checklist.

## Native configuration solution

- Added `prebuild:android`, which runs Expo Prebuild for Android without
  installing packages.
- Added `check:native-sync` and root `check:mobile-native-sync`. The guard runs
  Prebuild and fails if an Android diff requires review and commit.
- Replaced Expo Doctor's generic committed-native-project warning with this
  project-specific guard. The generic check is disabled only because the guard
  actively verifies synchronization; it must not be bypassed.
- Ran Prebuild and the native-sync guard successfully. No Android content diff
  was generated from the current `app.json`.
- On this Windows checkout, Expo Prebuild rewrote line endings in several
  tracked Android files. Git's content diff is empty, so this is not a semantic
  Android change and must not be treated as a generated native change to commit.

## Final validation after Phase 7 changes

| Gate | Result |
|---|---|
| Root and mobile frozen installs | Pass |
| `pnpm run check:mobile-native-sync` | Pass |
| `pnpm dlx expo-doctor@latest` from mobile boundary | Pass: 17/17 checks |
| Mobile typecheck | Pass |
| Mobile lint | Pass: 0 errors, 21 existing unused-symbol warnings |
| Android Expo export | Pass: 2,885 modules, 5.83 MB Hermes bundle |
| README command/documentation audit | Pass: mobile is documented as Expo Router and commands target its boundary |

## Release prerequisite that remains external to this host

Android SDK Platform-Tools, ADB, an emulator, and a USB-debugged device are not
available on this host. The device smoke checklist is documented but has not
been executed here. Before release, run the documented Android launch, role,
navigation, NativeWind visual, gesture, Fast Refresh, and logcat checks on an
emulator or physical device.

## Carried code-quality note

The 21 mobile unused-symbol lint warnings remain intentionally visible and must
be cleaned in a focused UI-quality change before release. ESLint 8 remains the
SDK 52-compatible, deprecated tooling lane until a coordinated Expo upgrade.

## Final recovery decision

All seven recovery phases are implemented and all available automated gates
pass. The workspace/dependency incident is resolved. The remaining device smoke
test is a release-validation prerequisite, not an unresolved workspace or
dependency defect. No commit or push was created.
