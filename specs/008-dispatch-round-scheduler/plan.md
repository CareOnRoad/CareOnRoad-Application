# Implementation Plan: Dispatch Round Scheduler

**Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

## Summary

Add leased claims to `dispatch_rounds`, implement a batch worker that processes
each claimed round in an isolated transaction, reuse dispatch eligibility and
ranking to open the next configured radius, and expose a worker-secret protected
internal route. Failures release the item lease and do not stop the batch.

## Technical Context

**Language**: TypeScript/Node/Next.js 15

**Storage**: PostgreSQL migration `202606250021_dispatch_round_leases.sql`

**Testing**: Vitest worker/route/static/migration plus PostgreSQL integration

**Performance**: bounded default batch 25; `FOR UPDATE SKIP LOCKED`; one workload batch per next round
**Constraints**: no frontend, maps, auto-assignment, new dependency, or hardcoded secret

## Constitution Check

- PASS: Worker secret stays backend-only and route uses existing authority helper.
- PASS: Lease claims, state changes, history, audit, and outbox use repositories/UoW.
- PASS: Candidate deduplication and active-workload filtering remain authoritative.
- PASS: Per-item transactions isolate failures and transaction retry remains active.
- PASS: No chatbot, ASR, payment, quote, reminder, or frontend change.

## Structure

```text
app/api/v1/internal/workers/dispatch/run/route.ts
src/features/dispatch/dispatch-worker.route-handlers.ts
src/features/dispatch/dispatch.service.ts
src/server/workers/dispatch.worker.ts
src/server/repositories/{contracts,testing,postgres}/dispatch.repository.ts
supabase/migrations/202606250021_dispatch_round_leases.sql
```

## Design

1. Extend round records with `leaseOwner` and `leaseExpiresAt`.
2. Claim expired active rounds deterministically with lease recovery and skip locks.
3. Worker claims once, then calls the dispatch service once per round in separate
   transactions; failure releases only that round's lease.
4. Round processing locks request/round/candidates, validates lease and expiry,
   expires open candidates, then either opens the next radius or escalates.
5. Extract/reuse one internal next-round creation path so worker and rider start
   share candidate query, workload batch, deduplication, ranking, expiry, audit,
   and outbox behavior.
6. Return only aggregate counters from the protected route.

## Complexity Tracking

No violations.
