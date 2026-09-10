# Research: Notification Provider Delivery

## Decision 1: FCM HTTP v1 with provider-neutral contract

- **Decision**: Implement the first adapter for FCM HTTP v1 behind a `NotificationProvider` contract.
- **Rationale**: FCM HTTP v1 is the supported direct server protocol, sends to a device registration token, and uses short-lived OAuth 2.0 access tokens. The neutral contract keeps APNs/Web Push out of this feature without coupling the worker to FCM.
- **Alternatives considered**: Firebase Admin SDK was not selected because the project forbids adding a dependency without separate approval. Legacy FCM server-key endpoints are not used.
- **Sources**: [FCM server environment](https://firebase.google.com/docs/cloud-messaging/server-environment), [FCM HTTP v1 send](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [FCM REST API](https://firebase.google.com/docs/reference/fcm/rest)

## Decision 2: Service-account OAuth using Node built-ins

- **Decision**: Mint and cache short-lived access tokens from backend-only project ID, client email, and private key configuration using an RS256 JWT and built-in `fetch`/`crypto`.
- **Rationale**: It avoids static long-lived bearer tokens and adds no dependency. Configuration parsing fails closed with a sanitized error.
- **Alternatives considered**: A static `FCM_ACCESS_TOKEN` expires and is unsuitable for unattended workers. Reading an arbitrary service-account JSON path adds deployment/file handling outside this feature.

## Decision 3: Typed provider classification

- **Decision**: Normalize outcomes to `success`, `invalid_credential`, `permanent_failure`, `throttled`, `timeout`, or `temporary_failure`.
- **Rationale**: FCM documents unregistered/invalid tokens as removable and quota/server errors as retryable with backoff. Raw provider messages are not propagated.
- **Alternatives considered**: HTTP-status-only classification loses structured FCM error details and could retry invalid tokens.
- **Source**: [FCM error codes](https://firebase.google.com/docs/cloud-messaging/error-codes)

## Decision 4: Per-device credential-version receipts

- **Decision**: Persist one receipt per notification, credential ID, and credential version.
- **Rationale**: Multi-device partial success survives worker retries and prevents already successful devices from being resent after a committed receipt. A rotated token is a new version and cannot be disabled by a stale provider result.
- **Alternatives considered**: A single notification status cannot represent mixed outcomes. Provider-side idempotency is not guaranteed.

## Decision 5: Terminal versus retryable aggregate result

- **Decision**: Retry the outbox event only while at least one eligible receipt is retryable. When all are terminal, mark the notification `sent` if any device succeeded; otherwise mark it `failed` with a sanitized terminal code and process the outbox event.
- **Rationale**: Permanent failures do not consume all outbox attempts, while user-visible delivery status remains honest.
- **Alternatives considered**: Marking every terminal batch sent creates false success; throwing for permanent failures creates pointless retries.
