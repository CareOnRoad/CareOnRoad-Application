# Tasks: CareOnRoad AI Chatbot MVP

**Input**: Design documents from `/specs/001-careonroad-chatbot-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chatbot-api.yaml, quickstart.md

**Tests**: Required by the constitution and feature spec for safety gate, schema validation, fallback, ASR failure handling, API behavior, rate limiting, and operational logging.

**Organization**: Tasks are grouped so each user story can be completed and tested independently after shared foundation work.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after dependencies in prior phases are complete
- **[Story]**: Which user story the task belongs to: US1 text diagnosis, US2 voice diagnosis, US3 latest diagnosis review
- Include exact file paths in every task

## Phase 1: Project Foundation

**Purpose**: Create the Next.js TypeScript project skeleton, shared config, demo docs, utility seams, and initial schemas.

- [X] T001 Create Next.js App Router TypeScript project files in `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, and `app/page.tsx`
- [X] T002 Add Vitest setup and npm scripts in `package.json` and `vitest.config.ts`
- [X] T003 Add local environment template in `.env.example`
- [X] T004 Add basic project overview and local run instructions in `README.md`
- [X] T005 Create shared API error response helper in `src/lib/api-error.ts`
- [X] T006 Implement simple in-memory chatbot rate limiter with injectable clock, session_id limit 10/hour, IP fallback limit 30/hour, and voice session limit 5/hour in `src/lib/rate-limit.ts`
- [X] T007 Implement structured server logger with sanitization for API key, raw audio, and full symptom text in `src/lib/server-logger.ts`
- [X] T008 Create feature directory placeholders in `src/features/chatbot/index.ts` and `src/features/asr/index.ts`
- [X] T009 Implement in-memory session store types and methods in `src/features/chatbot/session.store.ts`
- [X] T010 Implement component taxonomy constants and helpers in `src/features/chatbot/component-taxonomy.ts`
- [X] T011 Implement diagnosis Zod schema in `src/features/chatbot/diagnosis.schema.ts`
- [X] T012 Implement text and voice message request schemas in `src/features/chatbot/message.schema.ts`
- [X] T013 [P] Add schema tests for valid and invalid diagnosis JSON in `src/features/chatbot/__tests__/diagnosis.schema.test.ts`
- [X] T014 [P] Add message schema tests for text and multipart metadata cases in `src/features/chatbot/__tests__/message.schema.test.ts`

## Phase 2: Foundational Diagnosis Services

**Purpose**: Build shared diagnosis primitives that block all user stories.

- [X] T015 Implement Vietnamese text normalization in `src/features/chatbot/normalize-vi.ts`
- [X] T016 Implement dangerous motorcycle symptom safety gate in `src/features/chatbot/safety-gate.ts`
- [X] T017 Implement seeded local motorcycle knowledge entries and cost ranges in `src/features/chatbot/knowledge-base.ts`
- [X] T018 Implement keyword-based knowledge retrieval in `src/features/chatbot/retrieval.ts`
- [X] T019 Implement rule-based fallback diagnosis in `src/features/chatbot/fallback-diagnosis.ts`
- [X] T020 Implement post-validation business rules in `src/features/chatbot/post-validation.ts`
- [X] T021 [P] Add rate limiter unit tests with fake timers or injectable clock for session_id, IP fallback, voice limit, reset window, and 429 code selection in `src/lib/__tests__/rate-limit.test.ts`
- [X] T022 [P] Add structured logger sanitization tests to verify no OpenRouter API key, raw audio, or full symptom text is logged in `src/lib/__tests__/server-logger.test.ts`
- [X] T023 [P] Add normalization tests in `src/features/chatbot/__tests__/normalize-vi.test.ts`
- [X] T024 [P] Add safety gate tests for dangerous Vietnamese symptoms in `src/features/chatbot/__tests__/safety-gate.test.ts`
- [X] T025 [P] Add retrieval tests for common symptom groups in `src/features/chatbot/__tests__/retrieval.test.ts`
- [X] T026 [P] Add fallback diagnosis tests for safe and dangerous inputs in `src/features/chatbot/__tests__/fallback-diagnosis.test.ts`
- [X] T027 [P] Add post-validation tests for cost ranges, confidence, limits, and UNKNOWN mapping in `src/features/chatbot/__tests__/post-validation.test.ts`

**Checkpoint**: Diagnosis primitives, rate limiting, and safe logging utilities are ready. User story implementation can begin.

## Phase 3: User Story 1 - Text Symptom Diagnosis (Priority: P1)

**Goal**: A rider can create a demo session, submit Vietnamese text symptoms, and receive a short advisory diagnosis card.

**Independent Test**: Submit `Xe sang kho de va hao xang hon binh thuong.` as text and receive valid compact diagnosis JSON plus visible disclaimer.

### Tests for User Story 1

- [X] T028 [P] [US1] Add OpenRouter missing-key and timeout client tests in `src/features/chatbot/__tests__/openrouter.client.test.ts`
- [X] T029 [P] [US1] Add prompt builder tests for compact JSON-only constraints in `src/features/chatbot/__tests__/prompts.test.ts`
- [X] T030 [P] [US1] Add text diagnosis service tests for normal, fallback, invalid JSON, logging metadata, and dangerous override in `src/features/chatbot/__tests__/diagnosis.service.text.test.ts`
- [X] T031 [P] [US1] Add session creation route tests in `src/features/chatbot/__tests__/sessions.route.test.ts`
- [X] T032 [P] [US1] Add text message route tests in `src/features/chatbot/__tests__/messages.text.route.test.ts`
- [X] T033 [P] [US1] Add API 429 tests for POST message route session_id and IP rate limits with fake timers or injectable clock in `src/features/chatbot/__tests__/messages.rate-limit.route.test.ts`

### Implementation for User Story 1

- [X] T034 [US1] Implement compact Vietnamese JSON-only prompt builder in `src/features/chatbot/prompts.ts`
- [X] T035 [US1] Implement backend-only OpenRouter client with env reads, low max_tokens, temperature <= 0.2, timeout, and structured output request in `src/features/chatbot/openrouter.client.ts`
- [X] T036 [US1] Implement text diagnosis orchestration path in `src/features/chatbot/diagnosis.service.ts`
- [X] T037 [US1] Add structured operational logs around diagnosis pipeline events using event name, session_id, input_mode, request id, latency, fallback_used, risk_level, provider status, error code, and text length/hash in `src/features/chatbot/diagnosis.service.ts`
- [X] T038 [US1] Implement POST session route in `app/api/chatbot/sessions/route.ts`
- [X] T039 [US1] Implement JSON text input handling in `app/api/chatbot/sessions/[sessionId]/messages/route.ts`
- [X] T040 [US1] Integrate in-memory rate limiter before ASR or OpenRouter work in POST message route with HTTP 429 `RATE_LIMITED` or `AI_SESSION_LIMIT_EXCEEDED` responses in `app/api/chatbot/sessions/[sessionId]/messages/route.ts`
- [X] T041 [US1] Implement single Vietnamese chat page text submission in `app/page.tsx`
- [X] T042 [US1] Add basic responsive UI styles for text form and diagnosis card in `app/globals.css`
- [X] T043 [US1] Show required advisory disclaimer in `app/page.tsx`
- [X] T044 [US1] Verify OpenRouter key is not referenced by frontend code in `app/page.tsx`

**Checkpoint**: Text-only MVP works independently with fallback, dangerous override, rate limiting, and safe operational logging.

## Phase 4: User Story 2 - Voice Symptom Diagnosis (Priority: P1)

**Goal**: A rider can submit WAV voice input, see the transcription, and receive the same advisory diagnosis using only transcribed text.

**Independent Test**: Submit voice input with mocked ASR transcription and verify transcribed text is shown, diagnosis uses that text, rate limiting runs before ASR/OpenRouter, and raw audio is not sent to OpenRouter.

### Tests for User Story 2

- [X] T045 [P] [US2] Add ASR service tests for disabled, unavailable, empty transcription, invalid audio, and success in `src/features/asr/__tests__/asr.service.test.ts`
- [X] T046 [P] [US2] Add sherpa-onnx client env path tests in `src/features/asr/__tests__/sherpa-onnx.client.test.ts`
- [X] T047 [P] [US2] Add voice diagnosis service tests with mocked ASR in `src/features/chatbot/__tests__/diagnosis.service.voice.test.ts`
- [X] T048 [P] [US2] Add multipart voice message route tests with mocked ASR in `src/features/chatbot/__tests__/messages.voice.route.test.ts`
- [X] T049 [P] [US2] Add API 429 tests for voice request per-session hourly limit before ASR execution in `src/features/chatbot/__tests__/messages.voice-rate-limit.route.test.ts`

### Implementation for User Story 2

- [X] T050 [US2] Define ASR result types and service interface in `src/features/asr/asr.types.ts`
- [X] T051 [US2] Implement isolated sherpa-onnx client wrapper with env model paths and controlled ASR_NOT_AVAILABLE errors in `src/features/asr/sherpa-onnx.client.ts`
- [X] T052 [US2] Implement ASR service that validates WAV preference, handles disabled/unavailable/empty/invalid audio, and returns Vietnamese text in `src/features/asr/asr.service.ts`
- [X] T053 [US2] Integrate voice transcription path into `src/features/chatbot/diagnosis.service.ts`
- [X] T054 [US2] Implement multipart/form-data voice handling after rate-limit checks in `app/api/chatbot/sessions/[sessionId]/messages/route.ts`
- [X] T055 [US2] Add WAV upload or recording input and transcribed text display in `app/page.tsx`
- [X] T056 [US2] Ensure OpenRouter request builder receives only transcribed text and never audio data in `src/features/chatbot/diagnosis.service.ts`

**Checkpoint**: Voice MVP works with mocked or local ASR and preserves backend-only diagnosis.

## Phase 5: User Story 3 - Latest Diagnosis Review (Priority: P2)

**Goal**: A rider can retrieve the latest diagnosis for a demo session.

**Independent Test**: Submit a text or voice message, call latest diagnosis, and verify it returns the most recent diagnosis or a clear empty state.

### Tests for User Story 3

- [ ] T057 [P] [US3] Add latest diagnosis store tests in `src/features/chatbot/__tests__/session.store.test.ts`
- [X] T058 [P] [US3] Add latest diagnosis API route tests for found, empty, and missing session cases in `src/features/chatbot/__tests__/diagnosis.route.test.ts`

### Implementation for User Story 3

- [ ] T059 [US3] Add latest diagnosis retrieval helper in `src/features/chatbot/session.store.ts`
- [X] T060 [US3] Implement GET latest diagnosis route in `app/api/chatbot/sessions/[sessionId]/diagnosis/route.ts`
- [X] T061 [US3] Add UI refresh or restore latest diagnosis behavior in `app/page.tsx`

**Checkpoint**: Latest diagnosis review works independently after any successful message.

## Phase 6: UI Completion and Scope Guardrails

**Purpose**: Finish the single-screen demo and enforce excluded MVP scope.

- [X] T062 [P] Add loading, error, empty, and fallback badge UI states in `app/page.tsx`
- [X] T063 [P] Render risk level, can_continue_riding, VND total range, max 2 hypotheses, and recommended action in `app/page.tsx`
- [X] T064 [P] Add UI tests or component-level tests for diagnosis rendering constraints in `src/features/chatbot/__tests__/chat-page-rendering.test.tsx`
- [X] T065 Verify no motorcycle selector, brand dropdown, model dropdown, seeded vehicle context options, booking, dispatch, payment, or login UI exists in `app/page.tsx`
- [X] T066 Verify no OpenRouter environment variable names or API keys are exposed in client-rendered code in `app/page.tsx`

## Phase 7: Final QA and Documentation

**Purpose**: Validate the full local demo against quickstart and constitution gates.

- [X] T067 Update `.env.example` with all OpenRouter and sherpa-onnx variables from the plan in `.env.example`
- [X] T068 Update local setup, model path, test, and demo scenarios in `README.md`
- [X] T069 Run typecheck and fix issues in `package.json` scripts and affected TypeScript files
- [X] T070 Run lint and fix issues in `package.json` scripts and affected source files
- [X] T071 Run Vitest test suite and fix failures in `src/features/chatbot/__tests__/`, `src/features/asr/__tests__/`, and `src/lib/__tests__/`
- [X] T072 Manually test normal text input scenario from quickstart in `app/page.tsx`
- [X] T073 Manually test dangerous text input scenario from quickstart in `app/page.tsx`
- [X] T074 Manually test voice input with mocked or local sherpa-onnx transcription in `app/page.tsx`
- [X] T075 Manually test missing `OPENROUTER_API_KEY` fallback behavior through `app/api/chatbot/sessions/[sessionId]/messages/route.ts`
- [X] T076 Manually test message rate limit behavior returns HTTP 429 with `RATE_LIMITED` or `AI_SESSION_LIMIT_EXCEEDED` in `app/api/chatbot/sessions/[sessionId]/messages/route.ts`
- [X] T077 Verify no raw audio is sent to OpenRouter by inspecting `src/features/chatbot/openrouter.client.ts` and `src/features/chatbot/diagnosis.service.ts`
- [X] T078 Verify logs exclude OpenRouter API key, raw audio, and full symptom text by inspecting `src/lib/server-logger.ts` and `src/features/chatbot/diagnosis.service.ts`
- [X] T079 Verify final responses remain short, concise, non-markdown, and advisory in `src/features/chatbot/diagnosis.schema.ts` and `src/features/chatbot/post-validation.ts`

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 must complete before Phase 2.
- Phase 2 must complete before any user story phase.
- US1 text diagnosis can start after Phase 2 and is the MVP slice.
- US2 voice diagnosis depends on Phase 2 and can run after or alongside US1 once shared OpenRouter and diagnosis service seams exist.
- US3 latest diagnosis depends on session store and at least one completed message path.
- UI completion depends on US1 and US2.
- Final QA depends on all implementation phases.

### User Story Dependencies

- **US1 Text Symptom Diagnosis**: First MVP story; no dependency on US2 or US3.
- **US2 Voice Symptom Diagnosis**: Depends on shared diagnosis service and ASR wrapper; no dependency on US3.
- **US3 Latest Diagnosis Review**: Depends on session store persistence from US1 or US2.

### Within Each Story

- Tests first, then implementation.
- Schemas and pure services before route handlers.
- Rate limiting must execute before ASR and OpenRouter calls.
- Route handlers before UI integration.
- Story complete only after independent test criteria pass.

## Parallel Opportunities

- T013-T014 can run after schema files exist.
- T021-T027 can run in parallel after T015-T020 are drafted.
- T028-T033 can run in parallel before US1 implementation.
- T045-T049 can run in parallel before US2 implementation.
- T057-T058 can run in parallel before US3 implementation.
- T062-T064 can run in parallel after US1 and US2 route behavior stabilizes.

## Parallel Example: User Story 1

```bash
Task: "T028 Add OpenRouter missing-key and timeout client tests in src/features/chatbot/__tests__/openrouter.client.test.ts"
Task: "T029 Add prompt builder tests for compact JSON-only constraints in src/features/chatbot/__tests__/prompts.test.ts"
Task: "T030 Add text diagnosis service tests for normal, fallback, invalid JSON, logging metadata, and dangerous override in src/features/chatbot/__tests__/diagnosis.service.text.test.ts"
Task: "T031 Add session creation route tests in src/features/chatbot/__tests__/sessions.route.test.ts"
Task: "T032 Add text message route tests in src/features/chatbot/__tests__/messages.text.route.test.ts"
Task: "T033 Add API 429 tests for POST message route session_id and IP rate limits with fake timers or injectable clock in src/features/chatbot/__tests__/messages.rate-limit.route.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T045 Add ASR service tests for disabled, unavailable, empty transcription, invalid audio, and success in src/features/asr/__tests__/asr.service.test.ts"
Task: "T046 Add sherpa-onnx client env path tests in src/features/asr/__tests__/sherpa-onnx.client.test.ts"
Task: "T047 Add voice diagnosis service tests with mocked ASR in src/features/chatbot/__tests__/diagnosis.service.voice.test.ts"
Task: "T048 Add multipart voice message route tests with mocked ASR in src/features/chatbot/__tests__/messages.voice.route.test.ts"
Task: "T049 Add API 429 tests for voice request per-session hourly limit before ASR execution in src/features/chatbot/__tests__/messages.voice-rate-limit.route.test.ts"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 text diagnosis.
3. Validate text input, fallback, dangerous override, rate limiting, logging, and disclaimer.
4. Demo the smallest usable chatbot.

### Incremental Delivery

1. Add US2 voice diagnosis with mocked ASR first, then local sherpa-onnx runtime.
2. Add US3 latest diagnosis review.
3. Complete UI guardrails and final QA.

## Notes

- Tests are required for this MVP.
- Keep route handlers thin; application behavior belongs in `src/features/`.
- Keep rate limiting in memory for MVP; do not add Redis or a database.
- Keep operational logging as structured console/server logging for MVP; do not add an external logging provider.
- Logs may include event name, session_id, input_mode, request id, latency, fallback_used, risk_level, provider status, error code, and text length/hash.
- Logs must not include OpenRouter API key, raw audio, or full user symptom text.
- Keep OpenRouter backend-only.
- Keep ASR speech-to-text only.
- Do not add motorcycle selector, brand/model dropdown, booking, dispatch, payment, mechanic assignment, production login, or production database.
