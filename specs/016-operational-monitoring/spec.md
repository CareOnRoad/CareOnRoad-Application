# Feature Specification: Operational Monitoring APIs

**Created**: 2026-08-23 | **Status**: Ready for planning

## Clarifications

### Session 2026-08-23

- Q: How are worker runs represented when no reliable run history exists today? → A: Persist a new sanitized worker-run read model; do not infer runs from business records.
- Q: Can monitoring endpoints retry or mutate items? → A: No; all endpoints are admin-only reads.

## User Scenarios & Testing

### User Story 1 - Admin sees intervention queues (Priority: P1)

An admin lists dead-letter outbox events, payment orders needing review, and dispatch requests that have remained in dispatch states past a configured threshold.

**Independent Test**: Each owner-admin endpoint returns cursor-paginated redacted metadata and a non-admin receives 403.

### User Story 2 - Admin sees worker run health (Priority: P1)

An admin sees recent completed worker runs with generic name/status/counts/timestamps.

**Independent Test**: A worker run creates one sanitized record and the admin list exposes it without raw result/error payload.

### Acceptance Scenarios

1. Admin lists any queue with limit/cursor and receives stable newest-first pagination.
2. Responses omit outbox payload, payment provider fields, rider details, request problem/location, secrets, and raw errors.
3. Read calls do not change outbox/payment/request status or create audit/outbox rows.
4. Worker failure records only a normalized failure code and numeric summary.

### Edge Cases

- Malformed cursor/limit is rejected; empty queues return an empty list and no cursor.
- A request is “stuck” only when status is `dispatching` or `offered`, age exceeds threshold, and it has no unexpired active round.
- Concurrent worker records are append-only and ordered deterministically.

## Requirements

- **FR-001**: Only active admins may access operational monitoring APIs.
- **FR-002**: The system MUST provide separate cursor-paginated reads for dead-letter outbox, `needs_review` payments, stuck dispatch requests, and recent worker runs.
- **FR-003**: Monitoring responses MUST use explicit redacted DTOs and MUST NOT return raw payloads, private content, location, provider identifiers, credentials, or stack traces.
- **FR-004**: Read endpoints MUST NOT replay, retry, update status, audit, emit outbox events, or otherwise mutate business state.
- **FR-005**: Stuck dispatch age MUST be configurable, default 15 minutes, and bounded between 1 and 1440 minutes.
- **FR-006**: Worker run records MUST be append-only and contain only worker name, normalized status/error code, numeric counts, and timestamps.
- **FR-007**: Pagination MUST be deterministic using opaque cursors and limits 1–100.
- **FR-008**: Query indexes and tests MUST keep reads bounded and enforce migration/RLS/secret isolation.

## Key Entities

- **Operational Queue Item**: Redacted identifier/status/timestamps needed for intervention.
- **Worker Run Record**: Append-only sanitized result summary for one protected worker invocation.

## Success Criteria

- **SC-001**: 100% of forbidden roles receive no queue data.
- **SC-002**: Pagination returns no duplicates/omissions for a stable dataset.
- **SC-003**: Privacy tests find zero prohibited payload/provider/private fields in all DTOs.
- **SC-004**: Repeated monitoring reads produce zero business/audit/outbox mutations.

## Assumptions

- Intervention commands remain a future feature.
- Worker run retention is handled by Feature 14.
