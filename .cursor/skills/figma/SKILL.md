---
name: figma
description: Work with Figma design files for the CareOnRoad mobile app. Use when the user references Figma, asks to export tokens/components/icons/screens from Figma, requests design-to-code conversion, or needs to inspect/translate Figma designs into the React Native (Expo) mobile codebase under apps/mobile.
---

# Figma

## Purpose

This skill helps the agent translate Figma designs into the CareOnRoad mobile app (`apps/mobile`) and produce design artifacts that match the codebase. It does not call the Figma API directly — it guides the agent to inspect Figma context the user provides (links, screenshots, exported JSON) and to produce Expo-compatible code, tokens, and assets.

## When to use

- The user shares a Figma link, frame name, or screenshot and asks for implementation.
- The user asks to export design tokens (colors, typography, spacing) from Figma.
- The user asks to convert Figma components to React Native components.
- The user asks to extract icons/illustrations for the mobile bundle.
- The user asks to generate or reconcile screens against the existing `apps/mobile/app/**` routes.

## Workflow

1. **Confirm the source.** Ask the user to paste a Figma file URL or specific frame name if not already provided. Do not invent design values.
2. **Match existing patterns first.** Before generating new components, scan `apps/mobile/src/components/ui/` and the relevant screen under `apps/mobile/app/` to use existing primitives (`Button`, `Input`, `ConfirmDialog`, etc.) and the app theme.
3. **Translate design tokens.** Map Figma color/typography/spacing tokens into TypeScript constants colocated with the feature (e.g. extend `apps/mobile/src/lib/` or a feature-local `tokens.ts`). Do not duplicate Tailwind/web tokens — this app uses React Native with `StyleSheet`/`NativeWind`-style utilities.
4. **Produce Expo Router screens.** Add new routes under `apps/mobile/app/<role>/...` matching the existing tabs (`(auth)`, `mechanic/(tabs)`, `rider/(tabs)`, `rider/schedule`, `rider/vehicles`, etc.). Keep route files thin and push logic into `src/lib/*-service.ts` or `src/hooks/*`.
5. **Extract assets.** When icons or illustrations are needed, prefer SVG-as-React-component (via `react-native-svg` already used in the project) over raster images. Place feature-local assets under the route's `_assets/` or `apps/mobile/assets/images/`.
6. **Validate.** After changes, run the appropriate lint/typecheck for `apps/mobile` if available, and confirm the new code follows the conventions in `apps/mobile/README.md` and `RIDER_FLOW_INTEGRATION.md` (the currently focused integration doc).

## Output expectations

- TypeScript React Native components using `StyleSheet.create` or the project's existing UI primitives.
- Token files written as plain constants — no new runtime dependencies without asking.
- Files placed at paths that match the existing folder structure; never overwrite user files without confirmation.
- Short Vietnamese-friendly labels/strings consistent with the rest of the rider flow.

## Don't

- Do not introduce Figma API SDKs, OAuth flows, or network calls to `figma.com` unless the user asks.
- Do not invent values — if a token is unclear in the source, ask.
- Do not delete or rewrite unrelated screens.
- Do not add new third-party dependencies without confirming with the user (per AGENTS.md "Don't" section).
- Do not commit secrets or Figma personal access tokens to the repo.

## Quick checklist

- [ ] Source design confirmed (link or frame name)
- [ ] Existing `apps/mobile/src/components/ui/` and target route inspected
- [ ] Tokens mapped to TypeScript constants (no hardcoded duplicates)
- [ ] New route/component follows `apps/mobile` conventions (Expo Router, thin screens)
- [ ] Assets extracted as SVG components or placed under `apps/mobile/assets/`
- [ ] Lint/typecheck clean for changed files
