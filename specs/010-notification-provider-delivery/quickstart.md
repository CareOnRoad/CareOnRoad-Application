# Quickstart: Notification Provider Delivery

## Prerequisites

- Use only a linked test/development Supabase project.
- Configure a valid `PUSH_TOKEN_ENCRYPTION_KEY` for tests that decrypt credentials.
- Automated tests use fake providers; do not configure real FCM credentials for the test suite.

## Validation

```powershell
npm.cmd test -- src/features/notifications src/features/outbox src/server/db/__tests__/notification-provider-delivery-migration.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

For PostgreSQL integration after migration `202606250023` is applied:

```powershell
npm.cmd run test:db -- src/server/repositories/postgres/__tests__/notification-delivery.repository.integration.test.ts
```

## Expected outcomes

- Successful, invalid, permanent, throttled, timeout, and temporary fake outcomes are classified deterministically.
- Retrying a partial delivery skips terminal receipts.
- Invalid credential version is disabled without affecting a newer rotation.
- Missing provider configuration never marks a notification sent.
- No test output includes raw tokens, ciphertext, private keys, or raw provider payloads.
