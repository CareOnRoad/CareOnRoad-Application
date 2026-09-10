# Feature Specification: Cancel Request Closes Dispatch

**Feature Branch**: `feature/api-operations-console`

**Created**: 2026-08-23

**Status**: Implemented

**Input**: Rider or admin cancellation of a dispatching/offered service request must atomically close open dispatch work and remain safe against offer acceptance.

## User Scenarios & Testing

### User Story 1 - Rider Cancellation Removes Open Offers (Priority: P1)

As a rider, I need cancellation to remove every open mechanic offer so no mechanic can accept work I no longer need.

**Independent Test**: Cancel an offered request and verify the request is canceled, active rounds are closed, pending/offered candidates are cancelled, and the offers disappear from mechanic listings.

**Acceptance Scenarios**:

1. **Given** a dispatching or offered request, **When** its rider cancels it, **Then** the request, all active rounds, and all pending/offered candidates reach their canceled terminal states atomically.
2. **Given** a canceled offer, **When** its mechanic lists or accepts offers, **Then** it is not visible and cannot be accepted.
3. **Given** cancellation persistence fails, **When** the transaction rolls back, **Then** request, round, candidate, history, audit, and outbox remain unchanged.

### User Story 2 - Admin Cancellation Uses the Same Invariant (Priority: P2)

As an admin, I need supervised cancellation to enforce the same dispatch closure so administrative action cannot leave stale offers.

**Independent Test**: Run idempotent admin cancellation twice with the same key and verify one response/event set and one closed dispatch state.

**Acceptance Scenarios**:

1. **Given** an eligible request with open dispatch, **When** an admin cancels with a reason and idempotency key, **Then** dispatch is closed in the same transaction.
2. **Given** the same admin command is replayed, **When** the same key and payload are submitted, **Then** the original result is returned without duplicate history, audit, or outbox events.

### User Story 3 - Cancel Versus Accept Has One Winner (Priority: P3)

As operations staff, I need cancellation and offer acceptance to serialize safely so the system never creates an assignment for a canceled request.

**Independent Test**: Race cancel and accept in both commit orders and verify exactly one succeeds, with no orphan assignment or canceled request containing active work.

**Acceptance Scenarios**:

1. **Given** cancellation wins the shared lock order, **When** accept resumes, **Then** accept returns a controlled conflict and creates no assignment.
2. **Given** acceptance wins, **When** cancel resumes, **Then** cancel returns a controlled conflict and the accepted assignment remains valid.

### Edge Cases

- A submitted request with no dispatch still cancels normally.
- Historical closed rounds/candidates are not rewritten.
- Repeating rider cancellation against a terminal request produces a controlled conflict and no duplicate events.
- An active assignment blocks cancellation through the request cancellation path.

## Requirements

### Functional Requirements

- **FR-001**: Rider and admin cancellation MUST close all active dispatch rounds for the request in the same transaction as request cancellation.
- **FR-002**: Cancellation MUST change every pending/offered candidate for those rounds to `cancelled` and MUST preserve accepted/rejected/expired/cancelled candidates.
- **FR-003**: Canceled offers MUST not appear in mechanic offer listings or be accepted.
- **FR-004**: Accept and cancel MUST use a consistent lock order and produce exactly one valid winner.
- **FR-005**: Cancellation MUST create at most one request status-history row and one sanitized audit/outbox event set per valid command.
- **FR-006**: Admin replay with the same idempotency key/payload MUST return the original response without repeated mutations.
- **FR-007**: Terminal or assigned requests MUST reject cancellation without new history, audit, outbox, or dispatch mutations.
- **FR-008**: No dispatch/request data may be hard-deleted.
- **FR-009**: Existing RBAC, rider ownership, admin reason metadata, state transitions, and active-assignment guards MUST remain enforced.

## Success Criteria

- **SC-001**: 100% of open rounds and candidates are closed after every successful cancellation test.
- **SC-002**: A mechanic receives zero visible/acceptable offers from a canceled request.
- **SC-003**: Every cancel-versus-accept race produces one winner, zero orphan assignments, and zero canceled requests with active assignments.
- **SC-004**: Replays/terminal retries add zero duplicate history, audit, or outbox events.
- **SC-005**: Existing unit, authorization, concurrency, lint, typecheck, and build validation continue to pass.

## Assumptions

- Rider cancel remains a non-idempotency-header API; terminal retry is a controlled conflict with no mutation.
- Admin cancellation keeps its existing required idempotency key and reason.
- No migration is expected because rounds and candidates already expose the necessary statuses and indexes.
- No frontend or public response-field change is required.
