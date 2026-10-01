# Full automated regression report

## Result

All executable automated gates on this host pass. No dependency, typecheck,
unit/static test, lint error, bundle, API build, web build, or ASR smoke failure
was found.

## Passed gates

| Area | Gate | Result |
|---|---|---|
| Installation | Root and mobile frozen installs | Pass; both lockfiles remained unchanged |
| Mobile | Peer check and Expo dependency check | Pass |
| Mobile | Expo Doctor | Pass: 17/17 checks |
| Mobile | Native configuration synchronization | Pass |
| Mobile | Typecheck | Pass |
| Mobile | Lint | Pass: 0 errors, 21 existing unused-symbol warnings |
| Mobile | Android export | Pass: 2,885 modules and 5.83 MB Hermes bundle |
| API | Typecheck and lint | Pass |
| API | Unit/static/route suite | Pass: 164 files, 512 tests |
| API | Production build | Pass: Next.js 15.5.25 |
| API | Local ASR smoke | Pass |
| Web | Lint and production build | Pass: Next.js 16.3.4 |
| Repository | `git diff --check` | Pass; no whitespace error |

## Not executable on this host

- PostgreSQL integration tests: `TEST_DATABASE_URL` and `DATABASE_URL` are not
  configured. They were not run because they require a specifically authorized
  test database and can write test data.
- Android install/launch and UI smoke: Android SDK Platform-Tools, ADB, and an
  emulator or connected device are unavailable. Follow
  `apps/mobile/DEVICE-SMOKE-TEST.md` before release.

## Known non-blocking findings

- Mobile lint continues to report 21 unused import/variable warnings. They are
  not test errors, but should be cleaned before release because they can hide
  incomplete UI behavior.
- Expo SDK 52 uses the deprecated ESLint 8 compatibility lane. Do not upgrade
  ESLint independently; address it in a coordinated Expo/React Native upgrade.

No commit or push was created.
