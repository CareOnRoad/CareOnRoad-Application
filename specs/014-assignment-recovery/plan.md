# Implementation Plan: Assignment Recovery and Re-dispatch

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

## Summary

Add a pre-quote assignment recovery command that locks assignment/request state, records a distinct terminal status, completes idempotency/audit/outbox in one transaction, and lets the existing outbox worker invoke an idempotent dispatch restart using current ranking and workload rules.

## Technical Context

**Language/Version**: TypeScript 5 / Node.js Next.js runtime  
**Primary Dependencies**: Next.js App Router, Zod, existing `postgres` client; no new packages  
**Storage**: Hosted Supabase PostgreSQL with migration `202606250027_assignment_recovery.sql`  
**Testing**: Vitest unit/route/static plus PostgreSQL repository/concurrency integration  
**Target Platform**: Backend web service and protected workers  
**Project Type**: Next.js backend API  
**Performance Goals**: One bounded transaction per recovery; worker handoff remains batch-safe  
**Constraints**: Thin route, strict RBAC/ownership, row locks, idempotency, no payment bypass, sanitized metadata  
**Scale/Scope**: One endpoint, one outbox consumer, one enum extension, existing dispatch infrastructure

## Constitution Check

- **PASS — Advisory AI / chatbot safety**: No diagnosis, chatbot, ASR, or provider behavior changes.
- **PASS — Secret isolation**: No new secret and no raw private data in response, audit, outbox, or logs.
- **PASS — Backend scope**: Backend-only assignment/dispatch workflow; no UI, maps, refunds, or compensation.
- **PASS — Workflow integrity**: Actor role/ownership, request and assignment locks, partial unique indexes, idempotency, sanitized audit/outbox, and migration/concurrency tests are required.
- **PASS — Payment boundary**: Recovery is limited to `accepted` and `en_route`; quote/payment/work states are rejected.

Post-design re-check: PASS. The contract and data model retain all gates without a constitution exception.

## Architecture and Transaction Design

1. `POST /api/v1/assignments/[assignmentId]/recover` authenticates and requires `X-Idempotency-Key`.
2. `AssignmentRecoveryService` validates reason/role, locks assignment then request, prepares idempotency, re-checks eligible state, closes any open dispatch artifacts, writes `recovery_canceled`, request `submitted`, history, audit, and a deduplicated `assignment.recovery.requested` outbox event, then completes idempotency.
3. The outbox consumer invokes `DispatchService.restartRecoveredRequest(requestId)`. It locks the request and all rounds/candidates, returns success if already dispatching/offered/assigned, and otherwise creates a new round through the existing ranking path.
4. Database partial unique indexes continue to guarantee at most one active request/mechanic assignment and one active dispatch round.

## Project Structure

```text
app/api/v1/assignments/[assignmentId]/recover/route.ts
src/features/assignments/assignment-recovery.{schemas,service}.ts
src/features/assignments/__tests__/assignment-recovery.*.test.ts
src/features/dispatch/dispatch.service.ts
src/features/outbox/outbox-consumers.ts
src/server/repositories/contracts/{assignment,dispatch}.repository.ts
src/server/repositories/{postgres,testing}/*assignment*repository.ts
supabase/migrations/202606250027_assignment_recovery.sql
src/server/db/__tests__/assignment-recovery-migration.test.ts
```

**Structure Decision**: Preserve route → service → UnitOfWork/repository → PostgreSQL. Dispatch restart is a service method reused by the outbox consumer rather than duplicated in the route.

## Error and Privacy Contract

- `400 INVALID_INPUT`: malformed reason or missing idempotency header.
- `403 FORBIDDEN`: wrong role, mechanic ownership, or admin-only reason.
- `404 NOT_FOUND`: actor/application profile or assignment missing.
- `409 CONFLICT`: ineligible state, mismatched/in-progress idempotency, or unsafe request state.
- Audit/outbox include assignment/request/mechanic IDs, terminal state, and reason code only.

## Complexity Tracking

No constitution violations.
