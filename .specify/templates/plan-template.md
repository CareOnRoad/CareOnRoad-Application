# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Advisory output: Plan describes how AI diagnosis and price ranges remain
  advisory only, never final mechanic quotes.
- Backend ownership: Plan keeps safety gate, retrieval, provider-chain calls,
  JSON Schema validation, post-validation, fallback, rate limit, local ASR
  boundaries, and logging in backend code.
- Secret isolation: Plan ensures AI keys, Supabase service-role keys, database
  credentials, payment credentials, and worker secrets are backend-only and
  never exposed through frontend bundles, client config, logs, or browser/mobile
  requests.
- Vietnamese behavior: Plan covers Vietnamese rider input, Vietnamese response
  text, and Vietnamese fallback messages.
- Dangerous override: Plan handles brake failure, fuel leak, smoke, burning
  smell, unstable steering, and engine shutdown while riding as safety
  overrides that beat model output.
- Validated JSON: Plan validates every remote diagnosis-provider response
  against JSON Schema before display or persistence, with post-schema business
  checks.
- Safe fallback: Plan preserves the configured provider chain and local
  rule-based fallback for provider failure, timeout, quota, and invalid JSON.
- Backend scope: When backend service workflows are included, the plan limits
  them to authorized backend APIs, persistence, repository interfaces,
  migrations, dispatch/assignment, quotes, payment adapter/webhooks,
  time-based reminders, outbox, notifications, and audit.
- Excluded scope: Plan excludes frontend workflows, production payment checkout
  UI and settlement, refunds, inventory commerce, odometer-based reminders,
  live dispatch/tracking UI, chatbot/voice rewrites, and AI-only automatic
  booking, assignment, quote approval, or payment.
- Workflow integrity: Plan covers RBAC, ownership, state transitions,
  transaction constraints, idempotency, webhook replay, outbox reliability,
  sanitized audit, and migration tests where applicable.
- Required tests: Plan includes relevant chatbot regression, authorization,
  concurrency, idempotency, payment webhook, migration, and audit tests.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
