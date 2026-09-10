# Implementation Plan: Media Signed Upload

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: `specs/012-media-signed-upload/spec.md`

## Summary

Introduce an actor/resource-bound upload-intent workflow. The backend signs one private Supabase Storage path, later streams the exact object to verify MIME, size, and SHA-256, and atomically creates existing media metadata. A protected cleanup worker removes expired orphan objects. No raw bytes or signing credentials are persisted or logged.

## Technical Context

- Runtime: Next.js 15 App Router, Node.js, TypeScript, Zod.
- Persistence: hosted Supabase PostgreSQL through repository/UoW contracts.
- Storage: Supabase Storage REST API behind a provider interface; no new package.
- Validation defaults: JPEG/PNG/WebP, 8 MiB, 5 files/resource, 10-minute app intent.
- Tests: Vitest unit/route/static plus hosted PostgreSQL integration.

## Constitution Check

- PASS: backend-only, no frontend or chatbot/ASR rewrite.
- PASS: authorization at actor and object level.
- PASS: contested finalize/cleanup state protected by row locks, leases, and constraints.
- PASS: versioned migration, repository boundary, sanitized audit/outbox.
- PASS: service-role credential remains server-only.

## Project Structure

```text
app/api/v1/media/upload-intents/**
app/api/v1/internal/workers/media-uploads/cleanup/route.ts
src/features/media-uploads/**
src/server/repositories/contracts/media-upload-intent.repository.ts
src/server/repositories/{postgres,testing}/**
src/server/workers/media-upload-cleanup.worker.ts
supabase/migrations/202606250025_media_upload_intents.sql
```

## Design

1. Add `media_upload_intents` with a closed state check, exact resource check, unique object key, finalized media reference, expiry, and cleanup lease fields.
2. Add repository methods for create, actor-owned lock, resource quota count, expired lease claim, finalize, expire, and lease release.
3. Add `MediaStorageProvider` with `createSignedUpload`, `inspectAndHash`, and `remove`; implement raw-fetch Supabase adapter and deterministic fake.
4. Create intent only after loading active application actor and authorizing either owned request or mechanic-owned active assignment.
5. Finalize outside/inside transaction in two stages: load immutable owned intent, stream/hash provider object, then lock/re-check and persist one existing metadata row plus state/audit/outbox atomically.
6. Cleanup worker claims bounded expired pending intents, removes exact keys through provider, and marks expired. Missing objects count as successful cleanup; transient provider failures release/expire lease for retry.
7. Add thin authenticated routes and worker-secret route with controlled errors.

## Complexity Tracking

- Object verification streams bytes once because Supabase object metadata does not provide a trusted content digest. Bytes are bounded and never persisted.
- Provider signed URLs are documented as valid for two hours; application finalization uses a stricter ten-minute database expiry.
- Existing direct-reference media endpoints remain compatible but the new secure flow is the intended trusted path; removal is a later breaking change.

## Quality Gates

- Focused schemas/provider/service/worker/route/contract tests.
- Migration static and lifecycle tests.
- Hosted PostgreSQL integration including concurrent finalize.
- Full unit suite, typecheck, lint, build.
- Supabase migration list, dry-run, push, and confirmation.
