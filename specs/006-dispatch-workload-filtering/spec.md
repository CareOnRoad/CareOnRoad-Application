# Feature Specification: Dispatch Active-Workload Filtering

**Feature Branch**: `feature/api-operations-console`

**Created**: 2026-08-23

**Status**: Implemented

**Input**: User description: "CareOnRoad must exclude mechanics with active assignments from dispatch candidates and use actual active workload in deterministic production ranking without changing dispatch radii, assignment states, or frontend behavior."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Busy Mechanics Receive No Offer (Priority: P1)

As a rider starting dispatch, I need the system to consider only mechanics who can accept new work so that no offer is sent to a mechanic already handling an active assignment.

**Why this priority**: Offering work to a busy mechanic creates a predictable failure at acceptance time and delays roadside assistance.

**Independent Test**: Start dispatch with two otherwise eligible mechanics where one has an active assignment and verify that only the idle mechanic receives an offer.

**Acceptance Scenarios**:

1. **Given** an eligible mechanic with an active non-terminal assignment, **When** a rider starts dispatch, **Then** that mechanic is absent from the created candidates and offers.
2. **Given** an otherwise equivalent mechanic with no active assignment, **When** a rider starts dispatch, **Then** that mechanic remains eligible for ranking and may receive an offer.
3. **Given** every eligible mechanic is currently busy, **When** dispatch starts, **Then** a round may be created without offers and no busy mechanic becomes a candidate.

---

### User Story 2 - Ranking Uses Current Workload Deterministically (Priority: P2)

As an operations supervisor, I need dispatch ranking to use current workload for all eligible mechanics while preserving the existing deterministic ordering so that repeated dispatch decisions are explainable and stable.

**Why this priority**: Stable ordering supports fair operations, predictable tests, and incident investigation after the primary busy-mechanic exclusion is enforced.

**Independent Test**: Rank a fixed candidate set repeatedly with the same eligibility, location, skill, distance, rating, and workload values and verify the same order each time.

**Acceptance Scenarios**:

1. **Given** the authoritative workload query returns a positive active-workload count for a mechanic, **When** candidates are ranked, **Then** that mechanic is excluded; every remaining mechanic has a neutral active-workload value under the current single-active-assignment invariant.
2. **Given** candidates tied on all higher-priority signals, **When** ranking is repeated, **Then** the same mechanic identifier tie-break produces the same order every time.
3. **Given** a candidate set of any supported size, **When** workload is evaluated, **Then** workload is obtained as one batched evaluation rather than one evaluation per mechanic.

---

### User Story 3 - Concurrent Changes Remain Safe (Priority: P3)

As an operations supervisor, I need dispatch to remain safe when mechanic workload changes concurrently so that stale ranking information cannot create multiple active assignments.

**Why this priority**: Pre-filtering improves offer quality, but the contested assignment invariant still requires a final concurrency-safe guard.

**Independent Test**: Race offer acceptance against another active assignment creation and verify at most one active assignment exists for the mechanic.

**Acceptance Scenarios**:

1. **Given** a mechanic becomes busy after candidates are ranked, **When** that mechanic attempts to accept the offer, **Then** the existing atomic acceptance guard rejects the conflicting acceptance.
2. **Given** concurrent acceptance attempts, **When** transactions complete, **Then** the mechanic has at most one active assignment and no orphan assignment is created.

### Edge Cases

- A mechanic whose only assignments are completed or canceled is treated as idle.
- A mechanic with multiple rows representing active work is excluded even if historical data violates the expected single-active-assignment invariant.
- Missing workload data is treated conservatively as the existing neutral workload only when the mechanic has already passed the authoritative active-assignment exclusion.
- An empty candidate set still produces controlled dispatch behavior without an internal error.
- Workload changes after ranking do not weaken the atomic acceptance and database-constraint protections.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST exclude every mechanic with at least one active non-terminal assignment before creating dispatch candidates or offers.
- **FR-002**: The system MUST keep otherwise eligible mechanics with no active assignment available for ranking.
- **FR-003**: The system MUST evaluate active workload for the complete eligible mechanic set in a single batch per dispatch round.
- **FR-004**: The system MUST use the authoritative current active-workload value in the existing ranking sequence without bypassing eligibility, profile status, availability, location freshness, skill, distance, service radius, or rating rules.
- **FR-005**: The system MUST preserve deterministic ranking and use a stable mechanic-identifier tie-break when all preceding signals are equal.
- **FR-006**: The system MUST preserve atomic offer acceptance and active-assignment constraints as the final protection against concurrent workload changes.
- **FR-007**: The system MUST preserve the existing dispatch radius sequence, candidate batch limit, offer expiry, request state machine, and assignment state machine.
- **FR-008**: The system MUST avoid exposing assignment details through candidate responses, audit records, outbox payloads, or logs while calculating workload.
- **FR-009**: The system MUST retain controlled behavior when no idle candidates are available.

### CareOnRoad Backend Workflow Requirements

- **BE-001**: Backend workflows MUST enforce authenticated actor identity, RBAC, ownership, and object-level authorization.
- **BE-002**: Contested workflow invariants MUST be enforced with database transactions and constraints.
- **BE-003**: Dispatch and mechanic assignment MUST remain backend workflows with no live dispatch or mechanic-tracking UI.
- **BE-004**: Persistence MUST remain behind repository boundaries and use sanitized audit/outbox behavior where applicable.
- **BE-005**: Existing chatbot, ASR, reminder, quote, and payment behavior MUST remain unchanged.
- **BE-006**: Frontend work and new external dependencies MUST remain out of scope.

### Key Entities

- **Mechanic Active Workload**: The current count of non-terminal assignments owned by a mechanic, evaluated at dispatch time.
- **Dispatch Candidate**: A mechanic considered for a specific request and round after all eligibility and workload filters pass.
- **Active Assignment**: An assignment in any existing non-terminal status that prevents the assigned mechanic from receiving new work.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all validation scenarios, 100% of mechanics with active work are excluded before an offer is created.
- **SC-002**: A dispatch round performs no more than one batched workload evaluation regardless of the number of eligible mechanics.
- **SC-003**: Repeating ranking 100 times with identical inputs produces an identical candidate order every time.
- **SC-004**: Concurrent acceptance validation produces no more than one active assignment per mechanic and creates no orphan assignment.
- **SC-005**: Existing dispatch, assignment, authorization, and chatbot regression suites continue to pass without behavioral changes outside this feature.

## Assumptions

- Existing assignment statuses already identify terminal completed and canceled work; every other assignment status counts as active workload.
- Existing eligibility, location freshness, service-skill, distance, rating, radius, expiry, and candidate-limit rules remain authoritative.
- The existing database invariant and atomic acceptance flow remain the final concurrency protection.
- No new user-facing response fields are required; workload is internal dispatch data.
- No database schema change is expected unless planning finds that an efficient batch workload query cannot be expressed with the current assignment schema.
