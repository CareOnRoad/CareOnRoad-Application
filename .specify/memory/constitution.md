<!--
Sync Impact Report
Version change: 1.0.0 -> 1.1.0
Modified principles:
- I. Advisory AI, No Final Quote -> clarified separation between advisory AI
  output and authenticated backend workflows
- II. Backend-Controlled AI Safety -> retained provider chain, safety gate,
  local ASR, fallback, post-validation, and privacy-safe logging requirements
- III. Secret Isolation -> expanded to all AI, Supabase, database, payment, and
  service-role credentials
- IV. Vietnamese-First Chatbot -> retained without semantic change
- V. Validated JSON or Safe Fallback -> generalized from OpenRouter-only wording
  to the configured Gemini/OpenRouter provider chain
Added sections:
- Backend Workflow Integrity requirements within MVP Scope Boundaries
- Backend-only scope and exclusion gates within Required Quality Gates
Removed sections:
- AI-chatbot-only MVP restriction
Templates requiring updates:
- ✅ updated: .specify/templates/plan-template.md
- ✅ updated: .specify/templates/spec-template.md
- ✅ updated: .specify/templates/tasks-template.md
- not present: .specify/templates/commands/*.md
Feature artifacts:
- ✅ updated: specs/002-careonroad-backend-mvp/spec.md
- ✅ updated: specs/002-careonroad-backend-mvp/plan.md
Runtime guidance:
- reviewed: AGENTS.md; its "unless explicitly requested" scope rule already
  permits feature 002 and requires no amendment
- reviewed: README.md; unchanged because application implementation has not
  started and current runtime behavior remains chatbot-only
Follow-up TODOs: None
-->
# CareOnRoad MVP Constitution

## Core Principles

### I. Advisory AI, No Final Quote
The chatbot MUST present diagnosis, price ranges, and next actions as advisory
guidance only. It MUST NOT claim a final mechanical diagnosis, final repair
price, booking confirmation, mechanic assignment, quote approval, or payment
instruction. AI output MUST NOT initiate booking, assignment, quote approval,
or payment. Any chatbot-displayed price MUST be described as an estimate range
that requires mechanic or admin confirmation.

Authenticated backend workflows MAY create service requests, assignments,
versioned quotes, and payment orders when initiated by authorized actors and
validated by deterministic business rules. These records MUST NOT be presented
as decisions made solely by AI output.

Rationale: Riders need quick help, but roadside symptoms can be incomplete or
unsafe. The MVP must separate advisory AI from accountable service workflows.

### II. Backend-Controlled AI Safety
The backend MUST own the full AI safety path: dangerous-symptom detection,
retrieval of motorcycle knowledge, configured Gemini/OpenRouter provider calls,
JSON Schema validation, post-validation, rule-based fallback, rate limiting,
local ASR boundaries, and privacy-safe operational logging. The frontend MAY
collect rider messages and display validated responses, but it MUST NOT bypass
backend safety gates.

Dangerous symptoms MUST override model output. These symptoms include brake
failure, fuel leak, smoke, burning smell, unstable steering, and engine shutdown
while riding. When detected, the backend MUST set a high-risk response,
discourage continued riding, and prioritize emergency roadside advice.

Rationale: Safety-critical decisions must be deterministic, auditable, and
protected from model drift or prompt injection.

### III. Secret Isolation
AI provider keys, Supabase service-role keys, database credentials, payment
credentials, webhook secrets, and worker secrets MUST only exist in
backend-controlled configuration, environment variables, or secret storage.
They MUST NOT be exposed to frontend code, mobile bundles, browser-visible
network calls, logs, sample payloads, committed fixtures, or client-side
configuration.

Rationale: Exposing provider credentials would allow quota abuse, unexpected
cost, and loss of control over AI requests.

### IV. Vietnamese-First Chatbot
The chatbot MUST accept Vietnamese rider descriptions and return rider-facing
guidance in Vietnamese. Motorcycle terms, symptoms, safety warnings, and price
range explanations MUST be understandable for Vietnamese motorcycle riders.
Fallback responses MUST also be Vietnamese.

Rationale: The MVP is a Vietnamese roadside-assistance demo; language support is
part of the core product, not a later localization task.

### V. Validated JSON or Safe Fallback
Every configured remote diagnosis provider response MUST be parsed and
validated against the project JSON Schema before any rider-facing display or
persistence as a diagnosis result. Post-schema business validation MUST reject
unsafe or incoherent outputs, such as reversed price ranges or actions that
conflict with the detected risk level.

If Gemini, OpenRouter, or any configured diagnosis provider fails, times out,
exceeds quota, or returns invalid JSON, the backend MUST continue through the
configured provider chain and ultimately use the local rule-based fallback.
The fallback MUST preserve the advisory disclaimer, Vietnamese output, safety
overrides, and estimated price-range format where enough information exists.

Rationale: The demo must remain usable and safe even when the external AI
provider is unavailable or produces malformed output.

## MVP Scope Boundaries

The CareOnRoad MVP includes the completed Vietnamese AI chatbot and local voice
transcription plus backend-only service workflows. Authorized backend scope is:

- authentication, RBAC, and ownership enforcement;
- rider motorcycles and service requests;
- dispatch candidates and mechanic assignment;
- mechanic diagnosis and immutable versioned quotes;
- payment provider adapters, payment orders, signed webhook handling, replay
  protection, and payment audit state;
- time-based reminders;
- persistence, repository interfaces, Supabase/PostgreSQL migrations, outbox,
  notifications, and audit;
- persistence integration for existing chatbot sessions, messages, and
  diagnosis results without rewriting the chatbot or voice pipeline.

Backend workflows MUST enforce authorization, ownership, state transitions,
idempotency, concurrency invariants, and auditability. Payment support in this
MVP is limited to provider-neutral adapter and webhook infrastructure; it MUST
NOT claim production settlement readiness.

The MVP MUST NOT implement:

- frontend UI work or rider, mechanic, or admin frontend workflows;
- production payment checkout UI, production fund settlement, or refunds;
- inventory or spare-part commerce;
- odometer- or kilometer-based reminder logic;
- live dispatch UI or mechanic tracking UI;
- rewriting the existing AI chatbot or voice implementation;
- automatic booking, quote approval, payment, or mechanic assignment initiated
  solely from AI output.

Rationale: The expanded backend scope enables testable service workflows while
keeping user-facing product, financial settlement, and AI autonomy explicitly
out of scope.

## Required Quality Gates

Every feature plan that touches chatbot behavior MUST verify:

- advisory-only AI output and visible estimated-price wording;
- backend ownership of the safety gate, retrieval, provider chain, JSON Schema
  validation, post-validation, local fallback, rate limit, and logging;
- Vietnamese input and response behavior, including fallback responses;
- dangerous-symptom overrides for brake failure, fuel leak, smoke, burning
  smell, unstable steering, and engine shutdown while riding;
- raw audio remains local and is never sent to remote AI providers;
- AI provider failures, quota, timeout, and invalid JSON reach a safe fallback;
- existing chatbot/ASR behavior is preserved unless a separate feature
  explicitly authorizes a compatible change.

Every backend service-workflow plan MUST verify:

- backend-only scope and no unauthorized frontend work;
- authenticated actor identity, RBAC, ownership, and object-level authorization;
- database constraints and transactions for contested workflow invariants;
- idempotency and replay protection for assignment, payment, reminders, and
  asynchronous processing where applicable;
- payment scope is limited to adapter, order, webhook, and audit structure,
  without production checkout UI, settlement, or refunds;
- dispatch and mechanic assignment remain backend workflows with no live
  dispatch or tracking UI;
- versioned migrations, repository boundaries, outbox reliability, sanitized
  audit logging, and secret isolation;
- persistence integration does not remove or weaken chatbot safety behavior.

Tests MUST cover the gates relevant to the feature. Chatbot tests MUST retain
safety, schema validation, provider failure, fallback, and endpoint coverage.
Backend workflow tests MUST cover authorization, ownership, state transitions,
concurrency, idempotency, webhook replay, migration behavior, audit
sanitization, and chatbot regression where integration occurs.

Rationale: These checks protect the highest-risk AI, authorization,
concurrency, persistence, and payment-adapter behavior.

## Governance

This constitution supersedes conflicting project guidance for the CareOnRoad
MVP. Feature specs, plans, task lists, code reviews, and readiness checks MUST
verify compliance with the Core Principles, MVP Scope Boundaries, and Required
Quality Gates.

Amendments MUST be documented in `.specify/memory/constitution.md` with a Sync
Impact Report that lists changed principles, impacted templates, follow-up
items, and the version change. Any amendment that expands user-facing,
financial-settlement, AI-autonomy, or operational scope MUST include migration
and test impact.

Versioning follows semantic versioning:

- MAJOR for removing or redefining safety, secret, validation, fallback, or MVP
  scope principles in a backward-incompatible way.
- MINOR for adding new principles, required gates, or materially expanding MVP
  governance.
- PATCH for wording clarifications, typo fixes, or non-semantic refinements.

Compliance review is required before implementation tasks are accepted as
complete. A feature that cannot satisfy the constitution MUST either be changed
or explicitly wait for an approved constitutional amendment.

**Version**: 1.1.0 | **Ratified**: 2026-06-16 | **Last Amended**: 2026-06-25
