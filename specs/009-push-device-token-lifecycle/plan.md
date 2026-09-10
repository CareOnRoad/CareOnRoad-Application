# Implementation Plan: Push Device Token Lifecycle

**Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

## Summary

Add a backend-only credential table with AES-256-GCM encrypted push credentials
and SHA-256 fingerprints, plus transactional register/rotate/revoke/invalidate operations,
enforce global active-token uniqueness and five enabled devices per user, and
expose only redacted authenticated responses.

## Technical Context

**Language**: TypeScript/Node crypto/Next.js 15

**Storage**: Migration `202606250022_push_device_tokens.sql`

**Configuration**: backend-only `PUSH_TOKEN_ENCRYPTION_KEY` (32-byte base64)

**Testing**: Vitest crypto/service/route/migration/privacy plus PostgreSQL integration
**Constraints**: no new dependency, provider calls, frontend, raw token logs/events/errors

## Threat and Privacy Model

- Database read exposure must not reveal a usable token: store ciphertext, random
  96-bit IV, authentication tag, and fingerprint only.
- Key compromise is outside database scope; key stays in deployment secret storage
  and never enters frontend/env responses/logs.
- Fingerprint supports dedupe but is never returned in full.
- Services pass raw tokens only to the in-process encryption boundary and never
  interpolate them into messages, metadata, or provider calls in this feature.

## Constitution Check

- PASS: authenticated actor/ownership and admin redaction remain enforced.
- PASS: repository/UoW boundaries own persistence and cleanup.
- PASS: unique partial index and transactions enforce contested ownership.
- PASS: audit/outbox contain device ID/provider/status/count only.
- PASS: no frontend, notification send, new package, or unrelated workflow change.

## Structure

```text
src/features/auth/{auth.schemas.ts,auth.types.ts,auth.service.ts,auth.route-handlers.ts,push-token.crypto.ts}
app/api/v1/auth/devices/[deviceId]/push-token/route.ts
src/server/repositories/{contracts,testing,postgres}/device-delivery-credential.repository.ts
supabase/migrations/202606250022_push_device_tokens.sql
```

## Design

1. POST device registration optionally accepts paired `push_token`/`push_provider`.
2. PUT owned device push-token rotates; DELETE revokes.
3. Backend delivery code can call an ownership-checked repository invalidation
   operation for provider-invalid feedback in Feature 5.
4. Same-user token movement disables the prior credential; cross-user active
   ownership conflicts, with the database unique index as final guard.
5. Cleanup disables oldest enabled devices beyond five and clears their active
   push credentials.

## Complexity Tracking

No violations.
