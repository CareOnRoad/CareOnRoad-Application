# Feature Specification: Distributed Runtime Controls

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`

**Created**: 2026-08-23

**Status**: Draft

**Input**: Share chatbot rate limits and provider circuit state across multiple runtime instances without changing public behavior or safety fallback.

## User Scenarios & Testing

### User Story 1 - Consistent throttling across instances (Priority: P1)

As an operator of a multi-instance deployment, I need one request budget per rider/session/network identity so moving between instances cannot multiply the allowed request count.

**Independent Test**: Two independent runtime adapters consume the same logical bucket and together enforce the existing limit and reset contract.

**Acceptance Scenarios**:

1. **Given** two instances share runtime state, **When** requests alternate between them, **Then** the combined count reaches one common limit.
2. **Given** a bucket expires, **When** a later request arrives, **Then** a fresh window begins automatically.

### User Story 2 - Consistent provider protection (Priority: P2)

As an operator, I need provider failures observed by one instance to temporarily stop calls from every instance while preserving provider-chain fallback.

**Independent Test**: Failures recorded through one adapter open the provider circuit observed by a second adapter; expiry or success closes it.

**Acceptance Scenarios**:

1. **Given** failures reach the configured threshold, **When** another instance checks the provider, **Then** it skips that provider until cooldown expires.
2. **Given** shared controls are unavailable, **When** diagnosis proceeds, **Then** local controls and the safe provider/fallback chain remain usable.

### User Story 3 - Safe opt-in operations (Priority: P3)

As a local developer, I need current in-memory behavior by default and explicit configuration before shared controls are enabled.

**Independent Test**: Default configuration selects memory; shared configuration selects persistent controls; invalid/unavailable shared mode degrades to memory without exposing identifiers.

### Edge Cases

- Concurrent first writes to the same bucket must be atomic.
- IP identifiers must be one-way derived; raw IP, chatbot text, audio, credentials, and provider payloads are never stored.
- Shared-state timeouts/errors must not bypass safety gate or remove local diagnosis fallback.
- Expired buckets/circuit rows may be cleaned in bounded batches without affecting active rows.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST preserve existing chatbot limits, error codes, retry timing, scopes, and response headers.
- **FR-002**: Shared rate-limit consumption MUST be atomic across concurrent instances.
- **FR-003**: Shared provider circuit failures, successes, open state, and cooldown MUST be consistently visible across instances.
- **FR-004**: Shared records MUST expire and support bounded cleanup.
- **FR-005**: Shared keys MUST contain only purpose-scoped hashes and MUST NOT persist raw IP addresses, chatbot text, audio, secrets, or provider payloads.
- **FR-006**: Shared mode MUST be opt-in; memory mode MUST remain the default.
- **FR-007**: When the shared store is unavailable, the system MUST use process-local controls and preserve the safe provider chain and local fallback.
- **FR-008**: The selected design MUST reuse current persistence; introducing an external cache/provider is out of scope.
- **FR-009**: No UI, diagnosis pipeline, ASR, safety-gate, payment, dispatch, or public response-schema changes are allowed.

### CareOnRoad AI Chatbot Requirements

- **AI-001**: Dangerous symptom handling remains backend-owned and always overrides model output.
- **AI-002**: Provider failure/invalid output continues through the provider chain and then local fallback.
- **AI-003**: Raw audio stays local and all provider/database credentials remain backend-only.

### Key Entities

- **Runtime rate bucket**: Hashed scope/key, current fixed-window count, and expiry.
- **Provider circuit state**: Provider name, consecutive failure count, and optional open-until time.

## Assumptions

- Hosted PostgreSQL is already required and is the chosen shared store; an external cache would add an unapproved dependency and operating surface.
- Fixed-window semantics stay compatible with the existing in-memory limiter.
- Shared operations have a short timeout and fall back to an existing process-local adapter.

## Success Criteria

- **SC-001**: Concurrent requests across at least two simulated instances never exceed one configured shared allowance.
- **SC-002**: Circuit state changes become visible to another simulated instance before its next provider attempt.
- **SC-003**: Expired state is ignored immediately and can be removed in batches of at most 100 records.
- **SC-004**: Shared-store failure still returns a controlled chatbot result through existing safety/fallback behavior.
- **SC-005**: Automated privacy checks find no raw IP, chatbot text, audio, secret, or provider payload in shared runtime records.

## Out of Scope

- External cache services, new dependencies, UI, changes to rate-limit values, sliding-window algorithms, provider payload storage, and changes to chatbot diagnosis behavior.
