# Feature Specification: Rider Review and Mechanic Rating

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`

**Created**: 2026-08-23

**Status**: Draft

**Input**: Let the owning rider create exactly one review after assignment completion and maintain trusted mechanic rating aggregates.

## Clarifications

### Session 2026-08-23

- Q: Can a review be edited after creation? A: No. Reviews are immutable. Exact retries replay the existing review; any different payload for the assignment conflicts. This keeps rating history auditable and avoids an unrequested moderation/edit lifecycle.

## User Scenarios & Testing

### User Story 1 - Review a Completed Assignment (Priority: P1)

As the rider who owns a completed assignment's service request, I can submit one integer rating and an optional concise comment for its mechanic.

**Why this priority**: This creates the first trusted source for the rating used by dispatch and mechanic read models.

**Independent Test**: Submit reviews as the owner, foreign rider, mechanic, and admin against active/completed assignments and verify only the completed owner path creates one immutable row.

**Acceptance Scenarios**:

1. **Given** a completed assignment owned by the rider, **When** rating 1-5 is submitted, **Then** exactly one immutable review is created.
2. **Given** an active/canceled assignment, **When** a review is submitted, **Then** no review or aggregate change occurs.
3. **Given** a foreign rider, assigned mechanic, or admin-only actor, **When** review creation is attempted, **Then** no assignment/rider details are disclosed and no rating changes.

---

### User Story 2 - Retry Without Double Counting (Priority: P2)

As a rider on an unreliable connection, I can safely retry the same review request without increasing the mechanic's rating count twice.

**Why this priority**: Duplicate ratings would directly bias dispatch ranking.

**Independent Test**: Send concurrent same/different idempotency keys for one assignment and verify one review, one audit/outbox pair, and one aggregate contribution.

**Acceptance Scenarios**:

1. **Given** the same assignment and same normalized payload, **When** requests retry or race, **Then** all successful responses identify the same review and count remains one.
2. **Given** an existing immutable review, **When** a different rating/comment is submitted, **Then** the API returns conflict without changing the review or aggregate.
3. **Given** reuse of an idempotency key with a different payload, **When** submitted, **Then** it conflicts.

---

### User Story 3 - Rebuild Trusted Aggregates (Priority: P3)

As an operator, I can rebuild mechanic rating averages/counts solely from immutable review rows.

**Why this priority**: Stored aggregates can drift and need a deterministic repair path.

**Independent Test**: Corrupt profile aggregates, run the protected rebuild worker for all mechanics, and verify exact two-decimal average/count from review rows including zero-review profiles.

**Acceptance Scenarios**:

1. **Given** review rows and incorrect profile aggregates, **When** rebuild runs, **Then** every profile matches `AVG(rating)` and `COUNT(*)` from reviews.
2. **Given** a mechanic with no reviews, **When** rebuild runs, **Then** aggregate becomes average 0 and count 0.
3. **Given** invalid worker authority, **When** rebuild is requested, **Then** no aggregate changes.

### Edge Cases

- Rating is fractional, outside 1-5, boolean, string, or missing.
- Comment is whitespace-only, over 1000 characters, or includes content that must never enter audit/outbox.
- Assignment and service request completion states disagree due legacy data.
- Two different payloads race for the same assignment.
- Aggregate rebuild races with a review insert.

## Requirements

### Functional Requirements

- **FR-001**: Only an authenticated active rider owning the assignment's service request MAY create a review; mechanic/admin role alone grants no authority and the mechanic MUST NOT review their own assignment.
- **FR-002**: Both assignment and service request MUST be completed before review creation.
- **FR-003**: Rating MUST be an integer from 1 through 5; optional trimmed comment MUST be 1-1000 characters when present.
- **FR-004**: Exactly one immutable review MUST exist per assignment and MUST remain bound to its original request, rider, and mechanic.
- **FR-005**: Create MUST require `X-Idempotency-Key`; exact retries/concurrency MUST return one review without double counting, while changed payloads conflict.
- **FR-006**: Review insert and mechanic aggregate update MUST commit in the same transaction.
- **FR-007**: Aggregate MUST be recomputed from review rows, rounded to two decimals, rather than incrementally trusting the previous stored aggregate.
- **FR-008**: A worker-secret-protected operation MUST rebuild all mechanic aggregates from review rows, including zero-review profiles.
- **FR-009**: The create response MUST omit rider identity and internal idempotency/audit fields; audit/outbox MUST omit comment text and unnecessary rider data.
- **FR-010**: One sanitized audit row and one deduplicated outbox event MUST be appended only when a review is first created.
- **FR-011**: Ownership failures MUST use non-disclosing not-found behavior.
- **FR-012**: No update/delete/moderation/public review list/frontend endpoint is in scope.

### CareOnRoad Backend Workflow Requirements

- **BE-001**: Use existing authentication, assignment/request repositories, UoW, idempotency, audit/outbox, and worker-secret patterns.
- **BE-002**: Use a versioned migration with unique/composite ownership constraints, indexes, RLS, and revoked direct mutations.
- **BE-003**: Keep routes thin and preserve dispatch's existing use of `mechanic_profiles.rating_avg/rating_count`.
- **BE-004**: Do not add admin/mechanic rating mutation APIs.

### Key Entities

- **Service Review**: Immutable assignment-bound rating/comment authored by the owning rider.
- **Mechanic Rating Aggregate**: Denormalized two-decimal average and count derived solely from service reviews.
- **Review Mutation Evidence**: Sanitized audit/outbox event containing review/assignment/request/mechanic IDs and rating, never comment/rider profile data.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Twenty concurrent exact submissions produce one review row, one aggregate contribution, one audit row, and one outbox event.
- **SC-002**: Every unauthorized or pre-completion test produces zero review and aggregate changes.
- **SC-003**: Rebuild tests restore exact average/count for all profiles from review rows and are idempotent.
- **SC-004**: Responses, audit, and outbox reveal zero rider IDs, comment text, idempotency keys, or unrelated assignment data.
- **SC-005**: Dispatch/read-model regression tests consume the rebuilt aggregate without code-path changes.

## Assumptions

- Reviews are immutable for this MVP; corrections require a future separately authorized moderation lifecycle.
- Existing manually seeded rating values are reset/rebuilt from review rows when migration/rebuild runs.
- Comment text is returned only to the creating rider in the immediate response; it is not placed in event metadata.
