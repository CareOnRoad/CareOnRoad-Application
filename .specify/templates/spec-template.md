# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`

**Created**: [DATE]

**Status**: Draft

**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?
- For CareOnRoad chatbot work, specify behavior when the rider reports brake
  failure, fuel leak, smoke, burning smell, unstable steering, or engine
  shutdown while riding.
- For CareOnRoad chatbot work, specify fallback behavior when OpenRouter fails,
  times out, exceeds quota, or returns invalid JSON.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

### CareOnRoad AI Chatbot Requirements *(mandatory for chatbot MVP)*

- **AI-001**: AI output MUST be advisory only and MUST NOT be presented as a
  final mechanic quote, booking, payment, mechanic assignment, or final repair
  diagnosis.
- **AI-002**: Backend MUST own dangerous-symptom detection, retrieval,
  configured provider-chain calls, JSON Schema validation, post-validation,
  fallback, rate limiting, local ASR boundaries, and privacy-safe logging.
- **AI-003**: AI provider keys, Supabase service-role keys, database
  credentials, payment credentials, and worker secrets MUST remain backend-only
  and MUST NOT appear in frontend code, browser/mobile requests, client config,
  fixtures, or logs.
- **AI-004**: Chatbot input and rider-facing output MUST work in Vietnamese,
  including rule-based fallback responses.
- **AI-005**: Dangerous symptoms MUST override model output for brake failure,
  fuel leak, smoke, burning smell, unstable steering, and engine shutdown while
  riding.
- **AI-006**: Every remote diagnosis-provider response MUST be parsed and
  validated against JSON Schema before display or persistence.
- **AI-007**: System MUST continue through the configured provider chain and use
  local rule-based fallback when providers fail, time out, exceed quota, or
  return invalid JSON.
- **AI-008**: AI output MUST NOT confirm bookings, assign mechanics, approve
  quotes, initiate payment, or represent a final diagnosis or final price.
- **AI-009**: Raw audio MUST remain local to ASR and MUST NOT be sent to remote
  AI providers.

### CareOnRoad Backend Workflow Requirements *(mandatory when backend service workflows are in scope)*

- **BE-001**: Backend workflows MUST enforce authenticated actor identity,
  RBAC, ownership, and object-level authorization.
- **BE-002**: Contested workflow invariants MUST be enforced with database
  transactions and constraints.
- **BE-003**: Payment scope MUST be limited to provider adapters, payment orders,
  signed webhook handling, idempotency, and audit unless a later constitution
  amendment authorizes production checkout, settlement, or refunds.
- **BE-004**: Dispatch and mechanic assignment MAY be implemented as backend
  workflows, but live dispatch and mechanic tracking UI remain out of scope.
- **BE-005**: Reminder scope MUST remain time-based; odometer/km logic remains
  out of scope.
- **BE-006**: Persistence MUST use versioned migrations and repository
  boundaries, with outbox and sanitized audit behavior where applicable.
- **BE-007**: Existing chatbot and voice behavior MUST NOT be rewritten.
  Persistence adapters MAY be added for chatbot sessions, messages, and
  diagnosis results without weakening safety or fallback behavior.
- **BE-008**: Frontend UI work, rider/mechanic/admin frontend workflows,
  inventory commerce, production payment UI/settlement/refunds, and AI-only
  automatic booking, assignment, quote approval, or payment MUST remain out of
  scope.

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- [Assumption about target users, e.g., "Users have stable internet connectivity"]
- [Assumption about scope boundaries, e.g., "Mobile support is out of scope for v1"]
- [Assumption about data/environment, e.g., "Existing authentication system will be reused"]
- [Dependency on existing system/service, e.g., "Requires access to the existing user profile API"]
