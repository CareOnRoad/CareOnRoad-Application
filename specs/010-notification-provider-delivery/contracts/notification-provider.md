# Contract: Notification Provider

## Provider-neutral operation

`send(input)` receives one decrypted credential in backend memory plus sanitized notification title/body/data. It returns one typed outcome and never throws raw provider data.

### Input

- provider name
- raw credential (backend-only, never logged/persisted again)
- notification title and body
- bounded string data map
- stable notification/receipt identifier for tracing

### Outcome

- `success` with optional bounded provider message ID
- `invalid_credential` with sanitized code
- `permanent_failure` with sanitized code
- `throttled` with sanitized code and optional retry-after timestamp
- `timeout` with sanitized code
- `temporary_failure` with sanitized code

## Aggregate delivery contract

- Skip terminal receipts on replay.
- Disable invalid credentials only with matching credential version.
- Throw a sanitized retryable delivery error if any unresolved receipt remains retryable.
- Return terminal `sent` if at least one receipt succeeded.
- Return terminal `failed` if no receipt succeeded, including no active credential.
- Never include raw credentials or provider payloads in returned errors, audit, outbox, or worker response.
