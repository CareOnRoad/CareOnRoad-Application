# Feature Specification: Push Device Token Lifecycle

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`

**Created**: 2026-08-23
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Register or Rotate a Device Token (Priority: P1)

As an authenticated app user, I need to register and rotate a push delivery token for my device so future notifications can reach the current app installation.

**Independent Test**: Register a token, rotate it, and verify only the new credential is active while every API/audit/outbox/error representation is redacted.

### User Story 2 - Revoke or Invalidate a Token (Priority: P2)

As a user or delivery worker, I need a token disabled after user revocation or provider-invalid feedback so it cannot be used again.

**Independent Test**: Revoke through the owned device route and invalidate through the repository/service delivery hook; verify no active delivery credential remains.

### User Story 3 - Bound Active Devices Safely (Priority: P3)

As an operator, I need a fixed active-device limit and deterministic cleanup so abandoned registrations do not grow indefinitely.

**Independent Test**: Register beyond the limit and verify the oldest enabled device/token is disabled without affecting another user's devices.

## Acceptance Scenarios

1. One token fingerprint belongs to at most one active user/device.
2. Rotation removes the prior delivery credential from active use.
3. User revoke requires ownership; provider invalidation is backend-only.
4. API responses never contain the raw token, encrypted value, key material, or complete fingerprint.
5. Audit, outbox, logs, validation errors, and conflict errors never contain the raw token.
6. Server storage retains only encrypted delivery material plus a one-way fingerprint for deduplication.
7. Missing/invalid encryption configuration fails safely before persistence.
8. At most five devices remain enabled per user; oldest registrations are disabled deterministically.
9. No notification is sent and no frontend is added.

## Requirements

- **FR-001**: Authenticated active users MUST register and rotate a provider-neutral push token for an owned device.
- **FR-002**: The system MUST encrypt delivery credentials at rest with authenticated encryption and store a SHA-256 fingerprint for deduplication.
- **FR-003**: A partial database uniqueness constraint MUST prevent one active fingerprint across multiple devices/users.
- **FR-004**: Rotation, ownership transfer prevention, user revoke, provider invalidation, and cleanup MUST be transactional.
- **FR-005**: API responses and all operational records MUST redact token, ciphertext, nonce/tag, key material, and full fingerprint.
- **FR-006**: Active users MUST have no more than five enabled device registrations; deterministic oldest-first cleanup MUST disable excess devices and their tokens.
- **FR-007**: Repeated registration of the same token for the same device MUST be safe and MUST NOT create duplicate active credentials.
- **FR-008**: Existing device/admin APIs MUST remain redacted and compatible.
- **FR-009**: No provider delivery call, frontend, or new dependency is in scope.

## Success Criteria

- **SC-001**: Raw token search across API bodies, audit, outbox, logs, and errors returns zero matches in all tests.
- **SC-002**: Rotation/revoke/invalidation tests leave exactly the expected active credential count.
- **SC-003**: Cross-user/device duplicate races cannot commit two active copies.
- **SC-004**: Registering a sixth active device leaves exactly five enabled devices for that user.
- **SC-005**: Migration, unit, route, repository, typecheck, lint, build, and regression tests pass.

## Assumptions

- `PUSH_TOKEN_ENCRYPTION_KEY` is a backend-only 32-byte base64 key managed by deployment secrets.
- Supported provider labels are `fcm`, `apns`, and `webpush`; delivery integration is Feature 5.
- Existing `device_key` remains the stable installation identifier and is still stored only as a hash.
