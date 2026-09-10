# Implementation Plan: Distributed Runtime Controls

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

## Summary

Introduce awaitable runtime-control contracts with existing synchronous in-memory adapters and opt-in PostgreSQL adapters. Atomic database operations coordinate fixed-window consumption and provider circuit state; shared failures fall back to process-local controls. Persist only hashed keys and bounded state.

## Technical Context

**Language/Version**: TypeScript 5.6, Node.js/Next.js 15

**Primary Dependencies**: Existing `postgres`, Next.js, Zod; no additions

**Storage**: Existing PostgreSQL; in-memory default/fallback

**Testing**: Vitest unit/static/route and isolated PostgreSQL integration

**Target Platform**: Multiple Node.js/serverless instances plus local demo

**Performance Goals**: One atomic round trip per shared operation; bounded 100-row cleanup

**Constraints**: Preserve public contracts; no raw identifiers/content; short timeout and safe local fallback

## Constitution Check

*GATE: Passed before research and after design.*

- Backend retains safety gate, provider chain, JSON validation, local fallback, ASR boundary, and sanitized logging.
- Secrets remain backend-only and shared rows contain no raw IP, text, audio, error, or provider payload.
- No UI, dependency, provider, payment, dispatch, diagnosis, or Vietnamese behavior change.
- Versioned migration, repository boundary, atomic concurrency tests, TTL tests, and regression gates are required.

## Project Structure

```text
specs/017-distributed-runtime-controls/
├── plan.md
├── research.md
├── data-model.md
├── contracts/runtime-controls.md
├── quickstart.md
└── tasks.md

src/
├── lib/rate-limit.ts
├── features/chatbot/ai-diagnosis.client.ts
├── server/runtime-controls/
└── server/repositories/{contracts,postgres,testing}/

supabase/migrations/202606250029_distributed_runtime_controls.sql
```

**Structure Decision**: Preserve feature/service and repository boundaries. Runtime factories/adapters live under `src/server/runtime-controls`; callers depend only on small contracts.

## Complexity Tracking

No constitution violations.
