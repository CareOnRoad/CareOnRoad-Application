# Quickstart: Push Device Token Lifecycle

Generate a 32-byte key outside source control and place its base64 form in the
backend deployment secret `PUSH_TOKEN_ENCRYPTION_KEY`. Never print or commit it.

```powershell
npm.cmd test -- src/features/auth/__tests__/push-token.crypto.test.ts src/features/auth/__tests__/auth.service.test.ts src/features/auth/__tests__/auth.routes.test.ts src/server/db/__tests__/push-device-token-migration.test.ts
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Use only confirmed test/dev PostgreSQL for DB integration. Verify raw token
searches are empty across responses, snapshots of audit/outbox, and errors.
