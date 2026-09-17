# Android native configuration workflow

`apps/mobile/android` is committed and is generated/synchronized from the
Expo configuration in `app.json`. The project therefore uses **controlled
Prebuild**, not disposable Continuous Native Generation.

## When a native-affecting setting changes

This includes changes to app name, package identifier, orientation, splash or
adaptive-icon settings, Android permissions, or Expo config plugins.

1. Update `app.json`.
2. Run `pnpm.cmd --dir apps/mobile run prebuild:android`.
3. Review the generated `apps/mobile/android` diff and ensure custom native
   changes remain intentional.
4. Commit the `app.json` and Android changes together.

## Before a pull request is merged

Run `pnpm.cmd run check:mobile-native-sync` from the repository root. The
command runs Expo Prebuild without installing packages, then fails if it finds
an Android diff that needs review and commit.

The Expo Doctor generic app-config/native-project warning is disabled because
this explicit check provides a stronger, project-specific guard. Do not disable
or bypass `check:mobile-native-sync`.

If an iOS native project is added and committed later, extend the check to
include iOS before treating iOS config fields as synchronized.
