# Feature Specification: Health and Readiness

**Created**: 2026-08-23  
**Status**: Ready for planning

## Clarifications

### Session 2026-08-23

- Q: Can deployment infrastructure call probes without application credentials? → A: Yes; probe routes are unauthenticated but expose only fixed redacted fields.
- Q: Which dependencies gate readiness? → A: PostgreSQL always; worker/provider configuration only when enabled or partially configured.

## User Scenarios & Testing

### User Story 1 - Process liveness (Priority: P1)

Deployment infrastructure can determine that the process is running without touching a dependency.

**Independent Test**: Liveness returns a stable success response even when dependency probes fail.

### User Story 2 - Dependency readiness (Priority: P1)

Deployment and monitoring systems can determine whether the backend is safe to receive traffic.

**Independent Test**: Readiness returns success for healthy required dependencies and a controlled unavailable response for a failed/timed-out dependency.

### Acceptance Scenarios

1. **Given** a running process, **When** liveness is requested, **Then** it returns `ok` without database/provider calls.
2. **Given** PostgreSQL and enabled configuration checks are healthy, **When** readiness is requested, **Then** it returns `ready`.
3. **Given** any required check fails or exceeds its deadline, **When** readiness is requested, **Then** it returns `not_ready` with generic check names and no diagnostic secret.

### Edge Cases

- Partial provider configuration is unhealthy rather than silently treated as disabled.
- A slow probe cannot make the endpoint wait indefinitely.
- Probe responses never include URLs, credentials, stack traces, SQL, provider project/account identifiers, or raw errors.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST expose stable liveness and readiness GET endpoints for deployment infrastructure.
- **FR-002**: Liveness MUST be dependency-free and MUST NOT create audit/outbox records.
- **FR-003**: Readiness MUST check PostgreSQL and validate enabled/partially configured worker, notification, media, and payment configuration without executing business transactions or external provider calls.
- **FR-004**: Each readiness check MUST use a short configurable deadline bounded between 100 and 5000 milliseconds.
- **FR-005**: Readiness MUST return HTTP 200 only when all required checks pass and HTTP 503 otherwise.
- **FR-006**: Responses MUST contain only status, generic check name, and generic state; timing, secrets, URLs, provider identifiers, raw errors, and stack traces are excluded.
- **FR-007**: Probe routes MUST remain unauthenticated and must be rate-light, read-only, deterministic, and safe for frequent polling.
- **FR-008**: No AI diagnosis, payment transaction, media operation, notification delivery, audit, outbox, or frontend behavior may be triggered.

### Key Entities

- **Health Snapshot**: Overall `ok`, `ready`, or `not_ready` state plus generic component states.
- **Dependency Probe**: A bounded read-only check with a fixed public name and controlled outcome.

## Success Criteria

- **SC-001**: Liveness completes without dependency access in under 100 ms in normal local execution.
- **SC-002**: Readiness always completes within its configured deadline plus 100 ms scheduling tolerance.
- **SC-003**: 100% of simulated failure/timeout responses contain none of the prohibited diagnostic values.
- **SC-004**: Repeated probes create zero business, audit, or outbox records.

## Assumptions

- PostgreSQL is mandatory for `/api/v1` readiness.
- A provider with no related variables set is disabled; any partial configuration is unhealthy.
- Network reachability to optional providers is not probed to avoid real side effects/cost.
