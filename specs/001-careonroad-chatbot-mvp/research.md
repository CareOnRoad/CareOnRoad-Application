# Research: CareOnRoad AI Chatbot MVP

## Decision: Next.js App Router with API routes

**Rationale**: The MVP needs one local web page plus a small backend surface.
Next.js App Router keeps frontend and backend in one TypeScript project while
allowing thin route handlers to call isolated application services.

**Alternatives considered**:
- Separate backend service: more moving parts than needed for the demo.
- Frontend-only app: rejected because OpenRouter secrets and safety gates must
  stay backend-only.

## Decision: Zod for validation

**Rationale**: Zod can define request schemas, diagnosis response schema, and
post-validation entry points in TypeScript. This matches the requirement that
all provider output be validated before display or persistence.

**Alternatives considered**:
- Manual validation: too easy to miss nested constraints.
- JSON Schema-only runtime validation: useful for provider prompting, but Zod is
  simpler for server-side TypeScript tests and route handling.

## Decision: In-memory demo session store

**Rationale**: The MVP explicitly excludes persistent production database work.
An in-memory store supports session creation, message storage, latest diagnosis,
and tests without schema migrations or data operations.

**Alternatives considered**:
- SQLite or file storage: unnecessary persistence for this demo.
- Production database: rejected by scope.

## Decision: Isolated ASR wrapper service

**Rationale**: The ASR layer must only perform speech-to-text and must be
mockable in tests. A wrapper lets route handlers and diagnosis service depend on
a stable interface while `sherpa-onnx.client.ts` handles local runtime details.

**Alternatives considered**:
- Direct ASR calls inside route handlers: harder to test and mixes upload
  parsing with inference.
- Sending audio to a cloud ASR provider: rejected because raw audio must not be
  sent to OpenRouter or other remote AI paths for this MVP.

## Decision: Controlled `ASR_NOT_AVAILABLE` path

**Rationale**: Local sherpa-onnx runtime bindings may not exist in every
development environment. The client should remain isolated and return a
controlled error so voice tests can mock ASR and the UI can ask the rider to
type or record again.

**Alternatives considered**:
- Crash on missing runtime: poor local demo behavior.
- Skip voice route until runtime exists: violates MVP voice requirement.

## Decision: Backend-only OpenRouter client with fallback

**Rationale**: The OpenRouter key must never be exposed. A backend client reads
`OPENROUTER_API_KEY` and `OPENROUTER_MODEL`, applies timeout, low max tokens,
low temperature, compact JSON prompt, and returns controlled failures for
missing key, timeout, quota, provider error, or invalid response.

**Alternatives considered**:
- Browser-side OpenRouter call: rejected due to secret exposure.
- Required provider availability: rejected because fallback is mandatory.

## Decision: Compact JSON diagnosis schema

**Rationale**: The UI and API need short, token-efficient results. The schema
caps `short_answer`, hypotheses, actions, and follow-up questions, and limits
actions and risk values to enumerations.

**Alternatives considered**:
- Free-form model text: rejected because it cannot guarantee safety and output
  length.
- Long educational explanations: rejected by response style requirement.

## Decision: Safety gate before and after model output

**Rationale**: Dangerous symptoms must override model output. Running a safety
gate before the provider reduces risky prompting, and applying safety override
after validation prevents unsafe model recommendations from reaching the UI.

**Alternatives considered**:
- Model-only safety: rejected due to model drift and prompt risk.
- Safety only before model: insufficient if the model contradicts the gate.

## Decision: Seeded local knowledge retrieval

**Rationale**: Local symptom and cost-range entries provide consistent context
for common Vietnamese motorcycle issues and power rule-based fallback when
OpenRouter is unavailable.

**Alternatives considered**:
- No retrieval: weaker diagnosis and fallback quality.
- Vehicle model selector or seeded vehicle context selector: explicitly
  rejected by MVP scope.

## Decision: Vitest coverage focused on risk paths

**Rationale**: The highest-risk behavior is safety override, schema validation,
fallback, route behavior, ASR failure, and provider failure. Vitest supports
fast TypeScript unit tests and route-handler tests with mocks.

**Alternatives considered**:
- Manual QA only: insufficient for mandatory safety and fallback guarantees.
- Browser-only E2E first: useful later, but the MVP risk is in backend services.
