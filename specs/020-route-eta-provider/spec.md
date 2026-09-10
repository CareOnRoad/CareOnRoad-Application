# Feature Specification: Route ETA Provider

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`  
**Created**: 2026-08-23  
**Status**: Draft

## Overview

Provide an advisory route-distance and estimated-duration read model for an active assignment. The estimate helps authorized riders, assigned mechanics, and admins understand travel progress without changing dispatch or assignment state.

## User Scenarios & Testing

### User Story 1 - Read route ETA for an active assignment (Priority: P1)

An authorized actor requests the current route estimate from the assigned mechanic's latest fresh location to the service-request location.

**Acceptance Scenarios**:

1. **Given** an active assignment with fresh origin and valid destination, **When** an authorized actor requests the estimate and the route provider succeeds, **Then** the response contains route distance, estimated duration, calculation time, expiry time, source, and advisory warning.
2. **Given** the actor is neither the owning rider, assigned mechanic, nor an admin, **When** the actor requests the estimate, **Then** access is denied without revealing assignment location data.
3. **Given** the assignment is terminal, **When** the estimate is requested, **Then** a controlled conflict response is returned and the provider is not called.

### User Story 2 - Continue safely when routing is unavailable (Priority: P2)

An authorized actor still receives a controlled, clearly labelled fallback when the provider is disabled, times out, exceeds quota, rejects the request, or returns malformed data.

**Acceptance Scenarios**:

1. **Given** valid origin and destination coordinates but an unavailable provider, **When** the estimate is requested, **Then** the response returns straight-line distance only, no fabricated duration, and an explicit fallback source/reason.
2. **Given** origin is missing or older than the freshness limit, **When** the estimate is requested, **Then** the response is controlled unavailable and no provider request is made.
3. **Given** repeated equivalent requests inside the TTL, **When** they are processed, **Then** cached or in-flight work is reused and provider usage is bounded.

### Edge Cases

- The service request has no service coordinates.
- Coordinates are invalid or provider output contains negative/non-finite distance or duration.
- Multiple callers request the same assignment estimate concurrently.
- The provider request exceeds the configured timeout or returns quota/auth/server errors.
- Cached data expires while a new provider request is in flight.
- An assignment changes to a terminal state after a prior estimate was cached.

## Requirements

- **FR-001**: The system MUST expose an authenticated read operation for route ETA on an assignment.
- **FR-002**: Only the owning rider, assigned mechanic, or an admin MAY read the result.
- **FR-003**: Estimates MUST be limited to active assignment states and MUST use the latest assigned-mechanic location only when it is within the configured freshness window.
- **FR-004**: Destination MUST be the service request's stored coordinates; address geocoding is out of scope.
- **FR-005**: A successful provider result MUST return positive route distance and estimated duration, calculation timestamp, expiry timestamp, provider-neutral source, and advisory warning.
- **FR-006**: Provider timeout, quota, authentication, server, network, and malformed-response failures MUST become a controlled fallback or unavailable result and MUST NOT fail dispatch or mutate assignment/request state.
- **FR-007**: When both coordinates are valid and the provider is unavailable, the fallback MUST return straight-line distance only and MUST NOT fabricate a route duration.
- **FR-008**: Equivalent requests MUST be cached for a configurable TTL and concurrent in-flight requests MUST be deduplicated.
- **FR-009**: Provider credentials MUST remain backend-only; logs and error responses MUST exclude credentials and raw provider payloads.
- **FR-010**: Provider behavior MUST be behind a provider-neutral interface with a fake adapter for deterministic tests.
- **FR-011**: The estimate MUST NOT automatically transition an assignment, alter dispatch ranking, or make an absolute arrival commitment.
- **FR-012**: Two-wheeler provider results MUST carry an advisory warning because route coverage may be incomplete and availability varies by region.

## Assumptions and Dependencies

- Google Routes `ComputeRoutes` is the selected initial adapter and uses motorized two-wheeler travel mode.
- Existing mechanic and service-request coordinates are already collected; this feature does not add geocoding or a map UI.
- Active assignment statuses remain defined by the existing assignment state model.
- The route cache is an optimization only; authorization and active-state checks are re-evaluated for every request.

## Success Criteria

- **SC-001**: 100% of authorization tests prevent cross-assignment location disclosure.
- **SC-002**: 100% of provider timeout/quota/error/malformed cases return a controlled fallback or unavailable contract without changing workflow state.
- **SC-003**: Two simultaneous equivalent requests produce at most one provider call.
- **SC-004**: Cached results are reused only before expiry and never bypass current assignment-state checks.
- **SC-005**: Provider secrets and raw provider payloads are absent from client responses, audit/outbox data, and test logs.

## Out of Scope

Map UI, textual geocoding, turn-by-turn instructions, route polylines, dispatch ranking changes, automatic assignment transitions, live location history, WebSocket/SSE, and frontend work.
