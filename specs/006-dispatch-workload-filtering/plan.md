# Implementation Plan: Dispatch Active-Workload Filtering

**Branch**: `feature/api-operations-console` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-dispatch-workload-filtering/spec.md`

## Summary

Load each eligible mechanic's active-assignment count through one authoritative
batch repository query, exclude mechanics whose count is positive, and feed the
remaining zero-workload candidates through the existing deterministic dispatch
ranking. Production uses `UnitOfWork.assignments` directly; atomic acceptance,
database constraints, radii, expiry, and API responses remain unchanged.

## Technical Context

**Language/Version**: TypeScript 5, Node.js, Next.js 15 App Router

**Primary Dependencies**: Zod and postgres.js within the existing app; no new dependency

**Storage**: Hosted Supabase PostgreSQL through repository contracts and UnitOfWork

**Testing**: Vitest unit/route/static tests plus opt-in PostgreSQL integration tests

**Target Platform**: Existing Next.js server runtime

**Project Type**: Existing full-stack web app; backend-only feature slice

**Performance Goals**: Exactly one workload repository call/query per non-empty dispatch candidate cohort; preserve the existing 50-profile `<60s` hosted smoke threshold as regression evidence, not a production p95 claim

**Constraints**: No N+1 workload lookup, migration, response-schema change, frontend work, or locks added to advisory ranking

**Scale/Scope**: One repository contract, two adapters, dispatch service/ranking, and focused unit/PostgreSQL tests

## Constitution Check

*GATE: Passed before research and re-checked after design.*

- Advisory output: PASS; chatbot diagnosis and mechanic quotes are untouched.
- Backend ownership: PASS; change stays in backend dispatch/repository modules.
- Secret isolation: PASS; no secret handling or client output changes.
- Vietnamese behavior: PASS; existing rider-facing behavior is unchanged.
- Dangerous override: PASS; chatbot safety behavior is unchanged.
- Validated JSON: PASS; provider response processing is unchanged.
- Safe fallback: PASS; provider chain and fallback are unchanged.
- Backend scope: PASS; only dispatch and assignment repository internals change.
- Excluded scope: PASS; frontend, payment, maps, tracking, inventory, reminders,
  chatbot, and ASR remain untouched.
- Workflow integrity: PASS; auth, ownership, transitions, acceptance transaction,
  transaction retry, and partial unique indexes remain final guards.
- Required tests: PASS; workload, production wiring, deterministic ranking,
  N+1, PostgreSQL, and acceptance race regression tests are planned.

## Project Structure

### Documentation (this feature)

```text
specs/006-dispatch-workload-filtering/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── features/dispatch/
│   ├── dispatch.service.ts
│   ├── dispatch-ranking.ts
│   └── __tests__/
└── server/repositories/
    ├── contracts/assignment.repository.ts
    ├── testing/in-memory-assignment.repository.ts
    └── postgres/assignment.repository.ts
```

**Structure Decision**: Keep the existing feature-oriented Next.js layout.
Dispatch orchestration remains in `src/features/dispatch`; persistence remains
behind the assignment repository contract with matching in-memory and PostgreSQL
adapters. Tests stay beside their feature or adapter.

## Complexity Tracking

No constitution violations.

## Design Decisions

1. Add `listActiveWorkloadsByMechanicIds` to `AssignmentRepository` and return
   only mechanic IDs with positive active-assignment counts.
2. Implement one grouped PostgreSQL query and one grouped in-memory pass.
3. Load eligible mechanics first, remove previously offered IDs, call the batch
   method once, and exclude every positive count before ranking.
4. Use `ACTIVE_ASSIGNMENT_STATUSES` as the only active-state authority and avoid
   duplicating assignment status semantics in dispatch.
5. Keep ranking reads lock-free; the acceptance transaction and database unique
   constraints resolve concurrent workload changes.
6. Do not modify API contracts, migrations, audit/outbox payloads, or logs.
