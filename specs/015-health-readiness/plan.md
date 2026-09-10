# Implementation Plan: Health and Readiness

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

## Summary

Create dependency-free liveness and bounded readiness route handlers. Readiness composes injected probes, always checks PostgreSQL with `select 1`, validates optional configuration locally, redacts all failures, and never invokes business/provider operations.

## Technical Context

**Language/Version**: TypeScript 5 / Node.js  
**Dependencies**: Next.js, existing PostgreSQL client, Vitest; no new package  
**Storage**: Read-only PostgreSQL probe; no schema change  
**Testing**: Unit and route tests, typecheck, lint, build  
**Target**: Internal deployment/monitoring endpoints  
**Constraints**: Unauthenticated but fixed/redacted, timeout 100–5000 ms, no audit/outbox/provider calls

## Constitution Check

- PASS: Backend-only operational scope and secret isolation.
- PASS: No chatbot/ASR/payment transaction/provider behavior change.
- PASS: Read-only probes and tests cover failure, timeout, redaction, and side-effect boundaries.

Post-design check: PASS with no exception.

## Design

- `HealthService.liveness()` returns a constant snapshot.
- `HealthService.readiness()` evaluates `database` plus fixed-name configuration probes under one bounded timeout.
- `createDefaultHealthRouteHandlers()` injects a PostgreSQL `select 1` probe and a local configuration validator.
- Route response exposes `{ status, checks: [{ name, status }] }` only; no latency/error detail.
- Configuration categories: `workers`, `notifications`, `media`, `payments`. Empty optional provider groups are disabled/healthy; partial groups are unhealthy; enabled payment/worker requirements must be complete.

## Project Structure

```text
app/api/v1/internal/health/{live,ready}/route.ts
src/features/health/health.{service,route-handlers}.ts
src/features/health/__tests__/{health.service,health.routes}.test.ts
.env.example
AGENTS.md
```

## Complexity Tracking

No constitution violations and no migration.
