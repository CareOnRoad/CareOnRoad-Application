# Android device smoke test

The JavaScript/Metro bundle is verified in CI, but this checklist must run on
an Android emulator or USB-debugged device before a release.

## Prerequisites

- Install Android Studio with Android SDK Platform-Tools and one Android Virtual
  Device, or connect a physical Android device with USB debugging enabled.
- Confirm the device is visible with `adb devices`.
- Run commands from the repository root after both root and mobile dependencies
  have been installed.

## Build and launch

```powershell
pnpm.cmd --dir apps/mobile android
```

Keep Metro running, then inspect its terminal and `adb logcat` for runtime
errors. Do not continue if an Invalid Hook Call, Metro SHA-1, or module
resolution error appears.

## Required smoke checklist

- App launches without a red error screen.
- Role selection opens both rider and mechanic flows.
- Rider and mechanic tab navigation works.
- NativeWind colors, spacing, and typography render rather than unstyled
  fallback views.
- Gesture/navigation interactions work.
- Change a visible text value and confirm Fast Refresh updates the running app.

Record the emulator/device model, Android version, Expo/React Native versions,
date, and any console/logcat error in the pull request before release approval.
