# Feature Specification: Chatbot Session Ownership

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`  
**Created**: 2026-08-23  
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Private anonymous session (Priority: P1)

An anonymous demo user receives an opaque browser credential when creating a session; knowing a session ID alone cannot read, transcribe, or submit to it.

**Acceptance Scenarios**:

1. **Given** a newly created anonymous session, **When** its credential accompanies message, transcription, or diagnosis requests, **Then** access succeeds.
2. **Given** another browser knows only the session ID, **When** it calls any session resource, **Then** it receives the same not-found response without learning ownership details.

### User Story 2 - Claim session as authenticated user (Priority: P2)

An authenticated app user who still holds the anonymous credential can irreversibly claim that session; afterward the same user credential can authorize access.

**Acceptance Scenarios**:

1. **Given** an anonymous owned session, **When** its holder supplies valid authentication and ownership credential, **Then** the session binds to that user.
2. **Given** a different user or missing anonymous credential, **When** claim is attempted, **Then** it fails without changing ownership.

### Edge Cases

- Credentials are compared using stored one-way hashes and never logged/persisted raw.
- Repeated claim by the same owner is idempotent; a different owner conflicts.
- Pre-migration sessions have no credential and are inaccessible through secure production handlers; clients must start a new session.
- Local ASR remains anonymous-capable but session authorization occurs before transcription.

## Requirements

- **FR-001**: Session creation MUST issue a cryptographically random opaque credential while preserving the `{session_id}` JSON contract.
- **FR-002**: Create, message, transcription, and latest-diagnosis handlers MUST apply consistent ownership rules.
- **FR-003**: Anonymous credentials MUST use an HttpOnly same-site cookie and MAY also be accepted through an explicit header for non-browser clients.
- **FR-004**: Only a hash of the credential may be stored; raw credentials MUST NOT appear in persistence, logs, audit, or outbox.
- **FR-005**: Authorization failures MUST use indistinguishable not-found responses to limit session enumeration.
- **FR-006**: Claiming requires both a valid session credential and an authenticated active application user; claims are irreversible to a different user.
- **FR-007**: Existing anonymous demo behavior, diagnosis safety/fallback, rate limits, and local ASR boundaries MUST remain intact.
- **FR-008**: Legacy credential-less sessions MUST not remain guessable; clients create replacement sessions.
- **FR-009**: No JWT is required for normal anonymous chatbot or local ASR use.

## Key Entities

- **Session ownership**: Credential hash, optional owning user, claim timestamp.
- **Ownership credential**: Random client-held bearer secret scoped to one session.

## Success Criteria

- **SC-001**: Cross-session read/write tests reject 100% of requests with missing/wrong credentials.
- **SC-002**: Browser demo can create and use a session without JavaScript reading the credential.
- **SC-003**: Stored/audited session data contains no raw credential.
- **SC-004**: Existing diagnosis, safety, rate-limit, and transcription regression suites pass.

## Out of Scope

JWT-required chatbot, frontend redesign, credential recovery/sharing, multi-device session sync, diagnosis/ASR changes.
