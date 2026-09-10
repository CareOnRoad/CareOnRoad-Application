# Implementation Plan: CareOnRoad AI Chatbot MVP

**Branch**: `(none)` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-careonroad-chatbot-mvp/spec.md`

## Summary

Build a small full-stack TypeScript MVP for Vietnamese motorcycle roadside
diagnosis. A rider can submit Vietnamese text or WAV voice input. Voice is
transcribed locally through an isolated sherpa-onnx wrapper, then the backend
diagnosis pipeline validates, normalizes, safety-checks, retrieves local
knowledge, calls OpenRouter when available, validates compact JSON, applies
post-validation and safety overrides, falls back safely when needed, stores the
latest session result in memory, and returns a short advisory diagnosis card.

## Technical Context

**Language/Version**: TypeScript on Next.js App Router runtime

**Primary Dependencies**: Next.js App Router, Zod, Vitest, local sherpa-onnx
runtime or wrapper, OpenRouter Chat Completions over backend fetch

**Storage**: In-memory demo store only; no production database

**Testing**: Vitest for unit and route-handler tests with mocked OpenRouter and
mocked ASR wrapper

**Target Platform**: Local demo web app at `localhost:3000`

**Project Type**: Full-stack web app with frontend page and backend API routes

**Performance Goals**: Text diagnosis should return promptly for a local demo;
voice path should return transcription plus diagnosis when local ASR is
available. OpenRouter calls use timeout and low token limits to avoid slow
responses.

**Constraints**: Backend-only `OPENROUTER_API_KEY`; raw audio never leaves the
local backend; ASR performs speech-to-text only; compact JSON only; max 2
hypotheses, max 2 actions, max 2 follow-up questions; no selector UI; no
dispatch, booking, payment, mechanic assignment, production login, or
production database.

**Scale/Scope**: Single demo chatbot page, 3 API routes, in-memory sessions,
local seed knowledge, local ASR wrapper, and focused tests for safety, schema,
fallback, ASR failure, and API behavior.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Advisory output: PASS. Diagnosis card and schema require advisory text,
  estimated price ranges only, and the required disclaimer.
- Backend ownership: PASS. Route handlers call backend application services for
  validation, ASR, normalization, safety gate, retrieval, OpenRouter, schema
  validation, post-validation, fallback, storage, and logging.
- Secret isolation: PASS. OpenRouter client lives only in
  `src/features/chatbot/openrouter.client.ts` and reads server env variables.
- Vietnamese behavior: PASS. UI, ASR input, normalized text, prompt, fallback,
  and diagnosis response are Vietnamese-focused.
- Dangerous override: PASS. Safety gate and post-model override force
  high/critical risk, `can_continue_riding=false`, and emergency action.
- Validated JSON: PASS. Zod diagnosis schema validates provider output before
  display or storage; post-validation enforces cross-field constraints.
- Safe fallback: PASS. Missing API key, timeout, provider error, quota, invalid
  JSON, schema failure, and ASR unavailability are controlled paths.
- MVP scope: PASS. No vehicle selector, production auth, dispatch, booking,
  payment, mechanic assignment, or production database is planned.
- Required tests: PASS. Tests cover safety gate, schema, retrieval, fallback,
  OpenRouter failure handling, ASR empty transcription, text route, voice route,
  and dangerous override.

## Project Structure

### Documentation (this feature)

```text
specs/001-careonroad-chatbot-mvp/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- chatbot-api.yaml
`-- tasks.md
```

### Source Code (repository root)

```text
app/
|-- page.tsx
`-- api/
    `-- chatbot/
        `-- sessions/
            |-- route.ts
            `-- [sessionId]/
                |-- messages/
                |   `-- route.ts
                `-- diagnosis/
                    `-- route.ts

src/
`-- features/
    |-- chatbot/
    |   |-- diagnosis.schema.ts
    |   |-- message.schema.ts
    |   |-- component-taxonomy.ts
    |   |-- normalize-vi.ts
    |   |-- safety-gate.ts
    |   |-- knowledge-base.ts
    |   |-- retrieval.ts
    |   |-- prompts.ts
    |   |-- openrouter.client.ts
    |   |-- post-validation.ts
    |   |-- fallback-diagnosis.ts
    |   |-- diagnosis.service.ts
    |   |-- session.store.ts
    |   `-- __tests__/
    `-- asr/
        |-- asr.types.ts
        |-- sherpa-onnx.client.ts
        |-- asr.service.ts
        `-- __tests__/

models/
`-- sherpa-onnx-zipformer-vi-30M-int8-2026-02-09/
    |-- encoder.int8.onnx
    |-- decoder.onnx
    |-- joiner.int8.onnx
    `-- tokens.txt

.env.example
```

**Structure Decision**: Use one Next.js App Router project. API route files are
thin adapters; business behavior lives under `src/features/*` so tests can mock
ASR and OpenRouter without exercising UI code.

## Complexity Tracking

No constitution violations. No extra complexity exceptions are needed.

## Phase 0: Research

Research is captured in [research.md](research.md). All planning choices are
resolved by the user-provided stack and MVP constraints.

## Phase 1: Design & Contracts

Design artifacts:

- [data-model.md](data-model.md)
- [contracts/chatbot-api.yaml](contracts/chatbot-api.yaml)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- Advisory output: PASS. Contracts and data model keep `fallback_used`,
  estimated VND ranges, and disclaimer behavior.
- Backend ownership: PASS. Contracts expose only API routes; service modules own
  safety, retrieval, OpenRouter, validation, fallback, and storage.
- Secret isolation: PASS. Contracts never expose API key fields. Quickstart uses
  `.env.example` with empty values.
- Vietnamese behavior: PASS. Quickstart validates Vietnamese text and voice
  paths.
- Dangerous override: PASS. Data model and contracts include emergency action
  requirements for dangerous inputs.
- Validated JSON: PASS. Diagnosis schema and contract define strict bounded
  output.
- Safe fallback: PASS. Research, contracts, and quickstart cover missing key,
  provider failure, invalid JSON, and ASR failure.
- MVP scope: PASS. Artifacts explicitly exclude selectors, auth, dispatch,
  booking, payment, mechanic assignment, and production database.
- Required tests: PASS. Quickstart and research identify required Vitest
  coverage.
