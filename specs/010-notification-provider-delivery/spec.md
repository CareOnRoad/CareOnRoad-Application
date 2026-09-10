# Feature Specification: Notification Provider Delivery

**Feature Branch**: `feature/backend-dispatch-push-lifecycle`

**Created**: 2026-08-23

**Status**: Draft

**Input**: Connect persisted CareOnRoad notifications to a configured push provider without exposing credentials or treating a no-op as successful delivery.

## User Scenarios & Testing

### User Story 1 - Deliver Notifications to Active Devices (Priority: P1)

As an app user, I receive a newly created notification on every currently active registered device so operational updates reach me outside the app.

**Why this priority**: Persisted notifications provide no timely user value until they are delivered.

**Independent Test**: Create a notification for a user with two active devices, process its delivery event with a fake provider, and verify both devices receive the sanitized message exactly once.

**Acceptance Scenarios**:

1. **Given** a pending notification and active device credentials, **When** its delivery event is processed, **Then** each eligible device is attempted and successful deliveries are recorded.
2. **Given** a retry of the same event, **When** a device delivery was already successful, **Then** that device is not sent the same notification again.
3. **Given** no active device, **When** delivery is processed, **Then** the notification is completed as having no eligible destination without calling a provider.

---

### User Story 2 - Isolate Invalid and Partial Device Failures (Priority: P2)

As an app user with multiple devices, one stale or invalid token does not prevent valid devices from receiving the notification.

**Why this priority**: Device tokens naturally expire and must not make multi-device delivery fragile.

**Independent Test**: Return success, invalid-token, and temporary-failure outcomes for three devices and verify success is retained, the invalid credential is disabled, and only the temporary failure remains retryable.

**Acceptance Scenarios**:

1. **Given** an invalid provider credential, **When** the provider rejects it as invalid, **Then** only the matching credential version is disabled and is never retried.
2. **Given** a partial multi-device result, **When** at least one device has a retryable failure, **Then** successful/permanent outcomes remain recorded and the event is retried only for unresolved devices.
3. **Given** a permanent non-token provider rejection, **When** delivery is processed, **Then** that device attempt is terminal and the event is not retried solely for that result.

---

### User Story 3 - Fail Safely When Provider Is Unavailable (Priority: P3)

As an operator, I can trust worker status because missing configuration, throttling, timeout, and temporary provider failures are classified and retried or dead-lettered predictably.

**Why this priority**: False success would silently lose notifications and hide operational failures.

**Independent Test**: Run delivery with missing configuration and controlled fake outcomes, then verify controlled error codes, exponential retry, terminal dead-letter behavior, and sanitized logs/audit.

**Acceptance Scenarios**:

1. **Given** provider delivery is not configured, **When** a production consumer processes a notification event, **Then** it reports a controlled retryable configuration failure and does not mark the notification sent.
2. **Given** throttling, timeout, or temporary failure, **When** attempts remain, **Then** the outbox event uses the existing retry/backoff policy.
3. **Given** retry attempts are exhausted, **When** another temporary failure occurs, **Then** the event is dead-lettered with a sanitized error code.

### Edge Cases

- A credential rotates after an event is claimed but before invalidation is applied.
- A provider call succeeds but the worker fails before committing its delivery receipt.
- A user has credentials for more than one supported provider.
- Provider response includes a sensitive credential or payload in its error text.
- The notification was deleted or is not owned by the credential user.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST consume notification-created events through a configured provider-neutral delivery interface.
- **FR-002**: The system MUST load the notification and only enabled delivery credentials belonging to its recipient.
- **FR-003**: The system MUST track delivery status per notification and credential version so retries do not resend terminal outcomes.
- **FR-004**: The system MUST classify provider outcomes as success, invalid credential, permanent failure, throttled, timeout, or temporary failure.
- **FR-005**: The system MUST disable an invalid credential only when the rejected version is still current.
- **FR-006**: The system MUST retry only unresolved retryable deliveries using existing outbox retry/backoff and dead-letter behavior.
- **FR-007**: The system MUST treat a notification as delivered when every eligible device has a terminal outcome, including the no-active-device case, while preserving per-device failures for operations.
- **FR-008**: The production worker MUST fail with a controlled configuration error when provider delivery is not configured; a missing/no-op handler MUST NOT mark delivery successful.
- **FR-009**: Delivery events and per-device receipts MUST be deduplicated under concurrent or replayed processing.
- **FR-010**: Audit, errors, and logs MUST exclude raw device credentials, encrypted credential material, authorization secrets, and raw provider payloads.
- **FR-011**: Automated tests MUST use fake providers and MUST NOT call a real push service.
- **FR-012**: SMS, email, frontend notification UI, and notification preferences MUST remain out of scope.

### CareOnRoad Backend Workflow Requirements

- **BE-001**: Provider credentials and push tokens remain backend-only.
- **BE-002**: Receipt deduplication and conditional invalidation use repository and transaction boundaries.
- **BE-003**: Delivery audit is sanitized and MUST NOT emit a recursive notification event.
- **BE-004**: Existing chatbot, ASR, payment, dispatch, and assignment behavior remains unchanged.

### Key Entities

- **Notification Delivery Receipt**: A deduplicated outcome for one notification sent to one immutable device credential version.
- **Device Delivery Credential**: An enabled, encrypted provider credential owned by the notification recipient.
- **Provider Outcome**: A typed, sanitized classification used to decide terminal completion, invalidation, or retry.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A notification for up to five active devices produces no more than one successful provider send per device credential version across worker retries.
- **SC-002**: In a mixed three-device result, successful and invalid devices reach terminal status while only temporary failures are retried.
- **SC-003**: Missing provider configuration results in zero false-sent notifications in automated acceptance tests.
- **SC-004**: All delivery failure records and test logs contain zero raw device credentials or provider authorization values.
- **SC-005**: A batch continues processing other events after one notification delivery fails.

## Assumptions

- Feature 4 encrypted device credentials and the existing notification/outbox worker are available.
- The first production adapter targets FCM, while the delivery contract remains provider-neutral.
- A notification with no active destinations is terminal because there is nothing currently deliverable; the inbox feature still exposes the persisted notification.
- Provider-side idempotency is not assumed, so local terminal receipts prevent repeat sends after a committed success.
