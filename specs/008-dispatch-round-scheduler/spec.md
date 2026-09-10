# Feature Specification: Dispatch Round Scheduler

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`

**Created**: 2026-08-23
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Expired Dispatch Advances Automatically (Priority: P1)

As a rider, I need expired dispatch rounds to advance automatically through the configured search radii so assistance continues without another action.

**Independent Test**: Run the protected worker over an expired round and verify open offers expire, the round closes, and the next 2/5/8/12 km round opens without re-offering prior mechanics.

### User Story 2 - Exhausted Search Escalates Once (Priority: P2)

As operations staff, I need exhausted dispatch to enter manual escalation exactly once so unresolved requests become actionable without duplicate events.

**Independent Test**: Process the fourth/total-wait-expired round repeatedly and concurrently; verify one request transition and one escalation event set.

### User Story 3 - Concurrent Workers Are Safe (Priority: P3)

As an operator, I need leased batch processing so multiple worker instances do not process the same round and one bad item does not block other requests.

**Independent Test**: Run two workers against the same expired cohort, inject one item failure, and verify each round is claimed at most once while other items complete.

### Acceptance Scenarios

1. Expired active rounds are claimed in bounded batches with recoverable leases.
2. Open candidates become expired before a next round is created.
3. Mechanics already present on any prior candidate for the request are never re-offered.
4. Radius order and maximum remain exactly 2, 5, 8, and 12 km.
5. Four rounds or total wait exhaustion changes eligible requests to `manual_escalation` exactly once.
6. Requests already canceled, assigned, or escalated do not open another round.
7. Missing/invalid worker secret is rejected and cannot mutate data.
8. A per-item failure increments `failed`, releases its lease for retry, and does not stop other claimed items.

## Requirements

- **FR-001**: The worker MUST require `X-Worker-Secret` authority.
- **FR-002**: The repository MUST claim expired active rounds using lease owner, lease expiry, batch limit, deterministic order, and concurrent skip-lock semantics.
- **FR-003**: Processing MUST atomically expire pending/offered candidates and the claimed round before advancing.
- **FR-004**: Next-round creation MUST reuse authoritative eligibility, workload filtering, radii, ranking, expiry, batch limit, and prior-mechanic deduplication.
- **FR-005**: The worker MUST never auto-assign a mechanic.
- **FR-006**: Exhaustion MUST transition to manual escalation exactly once with sanitized history/audit/outbox.
- **FR-007**: Processing MUST be idempotent and safe across concurrent worker instances and lease recovery.
- **FR-008**: One failed claimed item MUST NOT prevent other items from completing.
- **FR-009**: Worker results MUST report claimed, advanced, escalated, skipped, and failed counts without secrets or rider details.
- **FR-010**: No frontend, maps, live tracking, or hardcoded worker secret is permitted.

## Success Criteria

- **SC-001**: Two concurrent workers process each expired round at most once.
- **SC-002**: 100% of next rounds follow 2/5/8/12 km and contain no prior mechanic.
- **SC-003**: Exhaustion produces exactly one escalation transition/event set under retries.
- **SC-004**: An injected failure does not reduce successful processing of other valid claimed items.
- **SC-005**: Protected route, worker, repository, full unit, typecheck, lint, and build validation pass.

## Assumptions

- A small additive migration may add lease metadata to dispatch rounds.
- Existing total wait of 360 seconds, offer expiry of 60 seconds, and maximum four rounds remain authoritative.
- Cron/deployment configuration calls the route externally and supplies the existing secret.
