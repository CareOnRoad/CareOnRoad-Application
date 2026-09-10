# Feature Specification: Assignment Recovery and Re-dispatch

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`  
**Created**: 2026-08-23  
**Status**: Ready for planning  
**Input**: Recover an accepted assignment when the mechanic cannot continue, is a no-show, or is confirmed unreachable, while preserving history and safely re-dispatching.

## Clarifications

### Session 2026-08-23

- Q: Which assignment stages may recover without bypassing quote or payment state? → A: Only `accepted` and `en_route`.
- Q: Which actors and reasons may initiate recovery? → A: The assigned mechanic may use `cannot_continue`; admins may also use `no_show` or `lost_contact`.
- Q: How is re-dispatch made reliable? → A: Commit recovery atomically, then use a deduplicated outbox handoff that can be retried.

## User Scenarios & Testing

### User Story 1 - Mechanic cannot continue (Priority: P1)

An assigned mechanic reports that they cannot continue before reaching the service location, freeing the request for another mechanic without erasing the original assignment.

**Independent Test**: Recover an accepted assignment as its mechanic and observe the old assignment terminal state, preserved history, released workload, and exactly one re-dispatch handoff.

**Acceptance Scenarios**:

1. **Given** an `accepted` or `en_route` assignment owned by a mechanic, **When** that mechanic submits `cannot_continue`, **Then** the assignment becomes `recovery_canceled`, history is retained, and the request becomes eligible for re-dispatch.
2. **Given** the same idempotency key and request body, **When** the command is retried, **Then** the original successful response is returned without another recovery or handoff.

### User Story 2 - Admin recovers no-show or lost-contact work (Priority: P1)

An admin recovers an eligible assignment after operational confirmation of a no-show or lost contact.

**Independent Test**: Recover an eligible assignment as admin using each admin-only reason and verify a non-admin cannot use those reasons.

**Acceptance Scenarios**:

1. **Given** an eligible assignment, **When** an admin submits `no_show` or `lost_contact`, **Then** recovery succeeds with sanitized audit metadata.
2. **Given** a mechanic, **When** they submit an admin-only reason, **Then** access is denied and no state changes.

### User Story 3 - Reliable re-dispatch handoff (Priority: P1)

Operations can rely on recovery to restart dispatch once, even when workers retry or multiple instances process concurrently.

**Independent Test**: Deliver the same recovery outbox event concurrently and verify at most one active dispatch round and no active assignment remain.

**Acceptance Scenarios**:

1. **Given** a recovered request, **When** the handoff event is processed, **Then** a new dispatch round is opened using existing ranking and active-workload rules.
2. **Given** the event is replayed, **When** a round is already active or the request has advanced, **Then** processing is an idempotent no-op.

### Edge Cases

- Recovery is rejected after diagnosis, quote, payment, work start, completion, or ordinary cancellation.
- A rider, unrelated mechanic, suspended actor, missing idempotency key, or mismatched retry body cannot recover an assignment.
- Concurrent recovery attempts cannot create two terminal transitions or two active rounds.
- Provider/worker failure leaves the durable outbox event retryable; it does not roll back the already committed, safe recovery state.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST allow recovery only from `accepted` or `en_route` assignments.
- **FR-002**: The assigned mechanic MUST be limited to reason `cannot_continue`; an active admin MAY use `cannot_continue`, `no_show`, or `lost_contact`.
- **FR-003**: A successful recovery MUST atomically lock the assignment and request, terminate the assignment as `recovery_canceled`, preserve history, move the request to `submitted`, and append sanitized audit/outbox records.
- **FR-004**: Recovery MUST require `X-Idempotency-Key` and provide replay/conflict/in-progress semantics.
- **FR-005**: The terminal recovery status MUST release both request and mechanic active-assignment uniqueness constraints without deleting the assignment.
- **FR-006**: Re-dispatch MUST reuse existing candidate eligibility, ranking, round limits, and active-workload filtering.
- **FR-007**: The recovery handoff MUST be deduplicated and safe under concurrent worker delivery.
- **FR-008**: The system MUST close any still-open dispatch round/candidates for the request before re-dispatch.
- **FR-009**: The system MUST NOT create a second active assignment, bypass quote/payment state, refund, compensate, or add frontend behavior.
- **FR-010**: Responses, logs, audit, and outbox MUST contain reason codes and identifiers only, without private payloads or secrets.

### Backend Workflow Integrity Requirements

- **BE-001**: Authentication, role, assignment ownership, and actor-active checks are mandatory.
- **BE-002**: Contested state changes MUST occur inside one database transaction with row locks and database uniqueness constraints.
- **BE-003**: Versioned migrations, repository boundaries, thin routes, sanitized audit, and reliable outbox processing MUST be preserved.
- **BE-004**: Existing chatbot, ASR, payment, quote, and frontend behavior MUST remain unchanged.

### Key Entities

- **Recovered Assignment**: Original work relationship plus terminal `recovery_canceled` status and status history.
- **Recovery Command**: Actor, assignment, reason code, idempotency identity, and deterministic response.
- **Recovery Dispatch Handoff**: Deduplicated outbox event that restarts dispatch after the recovery transaction commits.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of duplicate recovery retries return one logical outcome and produce one terminal transition.
- **SC-002**: Concurrent handoff processing produces at most one active dispatch round and zero active assignments for the recovered request.
- **SC-003**: 100% of recovery attempts outside the allowed actors, reasons, or states are rejected without partial mutation.
- **SC-004**: A recovered request is eligible for dispatch-worker processing on the next worker run without manual database repair.

## Assumptions

- Recovery is intentionally limited to pre-diagnosis stages; later operational disputes require a separate workflow.
- Existing dispatch round limits and candidate exclusion rules continue across recovery, so the recovered mechanic is not re-offered for the same request.
- No refund or compensation behavior is introduced.
