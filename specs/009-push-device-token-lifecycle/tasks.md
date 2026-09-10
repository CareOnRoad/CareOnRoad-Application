# Tasks: Push Device Token Lifecycle

- [X] T001 Add failing crypto round-trip/config tests in `src/features/auth/__tests__/push-token.crypto.test.ts`
- [X] T002 Implement AES-256-GCM/fingerprint boundary in `src/features/auth/push-token.crypto.ts`
- [X] T003 Add failing migration/privacy tests in `src/server/db/__tests__/push-device-token-migration.test.ts`
- [X] T004 Add migration `supabase/migrations/202606250022_push_device_tokens.sql` and expected migration lists
- [X] T005 Add dedicated credential and device-limit repositories with in-memory/PostgreSQL adapters
- [X] T006 Extend auth schemas/types with paired provider/token inputs and redacted response
- [X] T007 Add failing register/rotate/revoke/limit/privacy service tests in `src/features/auth/__tests__/auth.service.test.ts`
- [X] T008 Implement transactional lifecycle in `src/features/auth/auth.service.ts`
- [X] T009 Add failing PUT/DELETE redaction/ownership route tests in `src/features/auth/__tests__/auth.routes.test.ts`
- [X] T010 Implement route handlers and `app/api/v1/auth/devices/[deviceId]/push-token/route.ts`
- [X] T011 Add PostgreSQL uniqueness/rotation/cleanup tests in `src/server/repositories/postgres/__tests__/user.repository.integration.test.ts`
- [X] T012 Run focused/privacy/typecheck and full unit/lint/build validation
- [X] T013 Attempt confirmed test/dev DB validation and record external blockers
