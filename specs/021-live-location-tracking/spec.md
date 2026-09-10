# Feature Specification: Live Location Tracking Backend

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`  
**Created**: 2026-08-23  
**Status**: Draft

## Overview

Allow an assigned mechanic to publish a short-lived latest location while travelling to an active job, and allow only the owning rider, assigned mechanic, or admin to poll that latest point. The feature is privacy-first, opt-in, and stores no public or append-only GPS history.

## Clarifications

### Session 2026-08-23

- Q: What retention policy applies to detailed tracking coordinates? → A: No default; require explicit 1–1440 minute retention while tracking is enabled.
- Q: Who can publish and read tracking data? → A: Only assigned mechanic publishes; owner rider, assigned mechanic, and admin read.
- Q: Which lifecycle is tracking eligible? → A: Travel phase only (`accepted` and `en_route`); stop and delete when leaving those states.
- Q: What realtime transport is included? → A: Authenticated polling of latest location only.

## User Scenarios & Testing

### User Story 1 - Mechanic publishes latest travel location (Priority: P1)

The assigned mechanic sends a timestamped, accuracy-qualified location while the assignment is in its travel phase. A newer accepted update overwrites the previous point.

**Acceptance Scenarios**:

1. **Given** tracking is enabled with explicit retention and the actor is the assigned mechanic, **When** a valid fresh update is submitted in `accepted` or `en_route`, **Then** it becomes the assignment's only stored latest point with a server receipt time and expiry.
2. **Given** an unrelated mechanic, rider, or admin, **When** that actor attempts to publish, **Then** publication is denied.
3. **Given** an update is replayed, too old, too far in the future, invalid, inaccurate, or arrives inside the minimum interval, **When** it is submitted, **Then** it is rejected without replacing the latest point.
4. **Given** tracking is disabled or retention is missing/invalid, **When** publication is attempted, **Then** a controlled unavailable/conflict response is returned and no coordinate is stored.

### User Story 2 - Authorized actor polls the latest point (Priority: P2)

The owning rider, assigned mechanic, or admin polls the latest location without receiving location history.

**Acceptance Scenarios**:

1. **Given** a non-expired latest point, **When** an authorized reader polls, **Then** the response includes assignment ID, coordinates, observed/received/expiry timestamps, accuracy, and freshness state.
2. **Given** an unrelated actor, **When** they poll, **Then** access is denied without revealing coordinates.
3. **Given** no point exists or it has expired, **When** an authorized reader polls, **Then** a controlled not-found response is returned without returning stale coordinates.

### User Story 3 - Stop and clean up tracking (Priority: P3)

Tracking data is removed when the assignment leaves travel states, and a protected worker deletes expired rows in bounded batches.

**Acceptance Scenarios**:

1. **Given** a stored point, **When** assignment status changes from `accepted`/`en_route` to any other state, **Then** the point is deleted by a database invariant.
2. **Given** expired rows remain after a crash or delayed transition, **When** the protected cleanup worker runs, **Then** it deletes at most the requested batch size and is safe to repeat.

### Edge Cases

- Two updates race for the same assignment.
- An observed timestamp equals the currently stored timestamp.
- Clock skew places the point slightly in the future or beyond the maximum age.
- Accuracy is non-finite, negative, or above the allowed threshold.
- Assignment state changes concurrently with ingest.
- A read races with expiry or assignment transition.
- Cleanup workers run concurrently.

## Requirements

- **FR-001**: Tracking MUST default disabled and MUST require an explicit retention period from 1 to 1440 minutes before accepting coordinates.
- **FR-002**: Only the assigned active mechanic MAY publish for an assignment in `accepted` or `en_route`.
- **FR-003**: Input MUST contain valid latitude, longitude, observed timestamp, and accuracy from 0 through 100 meters.
- **FR-004**: Observed timestamps MUST be no more than 30 seconds old and no more than 5 seconds in the future at receipt time.
- **FR-005**: Each assignment MUST retain only one latest point; an accepted update MUST have an observed timestamp strictly newer than the stored point.
- **FR-006**: Accepted updates for the same assignment MUST be at least 5 seconds apart, enforced transactionally under concurrency.
- **FR-007**: Only the owning rider, assigned mechanic, or admin MAY read the non-expired latest point.
- **FR-008**: Read responses MUST expose only the latest point and freshness metadata, never history or another assignment's coordinates.
- **FR-009**: A point MUST expire using the configured short retention, and reads MUST never return expired data.
- **FR-010**: A database invariant MUST delete tracking data whenever assignment status leaves `accepted`/`en_route`; a protected worker MUST delete expired rows in bounded batches.
- **FR-011**: GPS updates MUST NOT change assignment/request state, dispatch order, ETA cache, or payment/chatbot behavior.
- **FR-012**: Raw coordinates MUST NOT appear in logs, audit metadata, outbox payloads, worker summaries, or controlled error responses.
- **FR-013**: Tracking tables MUST use RLS and deny direct client mutation/read; access is mediated by authenticated backend services.
- **FR-014**: The initial transport MUST be polling; WebSocket, SSE, frontend, route history, and public sharing are excluded.

## Key Entities

- **Assignment Latest Location**: One ephemeral row per assignment containing assigned mechanic, coordinates, observed time, accuracy, server receipt/update time, and expiry.
- **Tracking Configuration**: Server-only enable flag, retention minutes, timestamp windows, accuracy bound, update interval, and cleanup batch limit.

## Assumptions and Dependencies

- Feature 15 route ETA is available but is not automatically invoked or invalidated by ingest.
- Supabase/PostgreSQL and existing assignment/request/mechanic ownership records are authoritative.
- Client devices provide UTC timestamps and horizontal accuracy meters.
- Product approval is represented operationally by explicitly enabling the feature and setting retention minutes.

## Success Criteria

- **SC-001**: 100% of cross-assignment publish/read tests deny coordinate disclosure or mutation.
- **SC-002**: Concurrent or replayed updates never replace a strictly newer accepted point.
- **SC-003**: At most one location row exists per assignment at all times.
- **SC-004**: Terminal/non-travel transitions and cleanup make expired/ineligible coordinates unreadable in 100% of tests.
- **SC-005**: Raw coordinates are absent from audit, outbox, logs, errors, and worker summaries.
- **SC-006**: Polling reads return only one current point and no history collection.

## Out of Scope

WebSocket/SSE, frontend/map UI, background mobile SDK integration, public share links, route/location history, geofencing, automatic state transitions, ETA recalculation, and analytics derived from GPS traces.
