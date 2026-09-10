# Implementation Plan: Cancel Request Closes Dispatch

**Branch**: `feature/api-operations-console` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

## Summary

Add an atomic repository command that cancels open candidates and active rounds
for a request, use it inside rider and admin cancellation transactions, and
normalize accept/cancel locking to `service request → candidate`. Existing
authorization, state transitions, admin idempotency, audit/outbox, and database
assignment constraints remain authoritative.

## Technical Context

**Language/Version**: TypeScript 5, Node.js, Next.js 15  
**Dependencies**: Existing Zod/postgres.js stack; no new dependency  
**Storage**: Existing PostgreSQL dispatch/request tables; no migration  
**Testing**: Vitest unit/route/concurrency and opt-in PostgreSQL integration  
**Performance**: One set-based dispatch-close operation per cancellation  
**Constraints**: No hard delete, frontend, public schema, or unrelated workflow changes

## Constitution Check

- PASS: Backend-only repository/service changes preserve RBAC and ownership.
- PASS: Request cancellation, dispatch closure, history, audit, outbox, and
  idempotency remain inside one UnitOfWork transaction.
- PASS: Shared lock order plus existing unique constraints protect races.
- PASS: Audit/outbox metadata remains sanitized; no request text is added.
- PASS: Chatbot, ASR, payment, reminders, quotes, and frontend are untouched.

## Structure

```text
src/features/assignments/accept-assignment.service.ts
src/features/service-requests/service-request.service.ts
src/features/admin/admin-request-state.ts
src/server/repositories/contracts/dispatch.repository.ts
src/server/repositories/testing/in-memory-dispatch.repository.ts
src/server/repositories/postgres/dispatch.repository.ts
```

## Design

1. Add a read-only candidate lookup so accept can discover `requestId`, then
   lock the request and finally re-lock/revalidate the candidate.
2. Add `cancelOpenDispatchForRequest(requestId, now)` returning canceled round
   and candidate counts. It changes only active rounds and pending/offered rows.
3. Rider cancel validates ownership, locks the request, checks active assignment,
   closes dispatch, changes request state, and appends one event set atomically.
4. Admin cancel reuses the same repository command and existing idempotency flow.
5. Preserve controlled conflicts for terminal requests and both accept/cancel
   commit orders.

## Complexity Tracking

No constitution violations.
