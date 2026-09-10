# Implementation Plan: Rider Review and Mechanic Rating

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: `specs/013-rider-review-rating/spec.md`

## Summary

Add immutable, assignment-bound reviews created only by the owning rider after both assignment and request completion. Insert/replay handling and aggregate recomputation occur transactionally. A protected rebuild route deterministically restores every mechanic aggregate from review rows.

## Technical Context

- Next.js App Router, TypeScript, Zod, Vitest.
- Supabase PostgreSQL repository/UoW with hosted integration tests.
- Existing JWT actor, idempotency, audit/outbox, and worker-secret infrastructure.
- No new dependency, frontend, moderation, or public review API.

## Constitution Check

- PASS: object ownership and RBAC are explicit.
- PASS: exactly-one and identity binding use database constraints.
- PASS: insert, aggregate, audit, outbox, and idempotency are one transaction.
- PASS: response/event privacy omits rider profile and comment events.
- PASS: versioned migration/repository boundaries; chatbot/payment/media unaffected.

## Project Structure

```text
app/api/v1/assignments/[assignmentId]/review/route.ts
app/api/v1/internal/workers/reviews/rebuild-ratings/route.ts
src/features/reviews/**
src/server/repositories/contracts/review.repository.ts
src/server/repositories/{postgres,testing}/**
src/server/workers/review-rating-rebuild.worker.ts
supabase/migrations/202606250026_service_reviews.sql
```

## Design

1. Create immutable `service_reviews` with unique assignment, composite assignment/request/mechanic identity FK, composite request/rider FK, rating/comment checks, indexes, RLS, and revoked direct access.
2. Reset/backfill profile aggregates from review rows in the migration so reviews become the only source of truth.
3. Add repository `createIfAbsent`, assignment lookup, per-mechanic aggregate rebuild, and all-profile rebuild.
4. In the service transaction: authenticate active rider, lock assignment/request, verify both completed and ownership, prepare idempotency, create/replay one immutable row, recompute profile aggregate from rows, then append sanitized audit/outbox and complete idempotency.
5. Add thin POST review route and protected aggregate-rebuild worker route.
6. Test ownership, status, validation, immutable conflicts, same-payload concurrency, aggregate rounding/rebuild, privacy, dispatch read compatibility, and PostgreSQL constraints.

## Complexity Tracking

- Aggregate is recomputed after each new review instead of incremental arithmetic. This is more robust against drift and prevents double-count logic; review volume is MVP-scale and indexed by mechanic.
- Immutable reviews intentionally have no correction API. A future moderation feature requires separate authorization/audit requirements.

## Quality Gates

- Focused schema/service/route/repository/worker/migration tests.
- Hosted PostgreSQL concurrency and rebuild integration.
- Full unit suite, typecheck, lint, build.
- Supabase migration list/dry-run/push/confirm.
