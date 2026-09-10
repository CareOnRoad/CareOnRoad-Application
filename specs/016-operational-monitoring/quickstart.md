# Quickstart: Operational Monitoring

Apply migration 028 on test/dev, run protected workers once, then call each endpoint with an admin JWT. Verify non-admin 403, pagination stability, redacted DTOs, and no business/audit/outbox mutation.

```powershell
npm.cmd test -- src/features/operations
npm.cmd run test:db -- src/server/repositories/postgres/__tests__/operational-monitoring.repository.integration.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```
