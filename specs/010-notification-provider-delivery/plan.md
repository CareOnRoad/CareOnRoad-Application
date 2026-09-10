# Implementation Plan: Notification Provider Delivery

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

## Summary

Replace production no-op notification consumption with a provider-neutral delivery service, an FCM HTTP v1 adapter, encrypted credential loading, per-device/version delivery receipts, conditional invalidation, and typed retryable/terminal outcomes integrated with the existing outbox lease/backoff worker.

## Technical Context

**Language/Version**: TypeScript 5, Node.js runtime, Next.js 15 App Router

**Primary Dependencies**: Existing Zod/Postgres stack plus Node `crypto` and built-in `fetch`; no new package

**Storage**: Supabase PostgreSQL migration `202606250023_notification_provider_delivery.sql`

**Testing**: Vitest unit/route/static tests and PostgreSQL repository integration

**Target Platform**: Backend Node.js worker route

**Project Type**: Backend feature inside the existing web application

**Performance Goals**: At most five device sends per notification; bounded worker batch; no repeat send after committed terminal receipt

**Constraints**: No real provider calls in tests, no raw tokens/provider secrets in logs or persistence, no frontend/SMS/email, no new dependency

**Scale/Scope**: Existing MVP device limit of five enabled devices per user and outbox batch default of 25

## Constitution Check

- PASS — backend-only worker and provider configuration; no frontend changes.
- PASS — FCM service-account material and decrypted tokens never enter responses, audit, outbox, or logs.
- PASS — receipt uniqueness, conditional token invalidation, and notification status updates use repository/UoW boundaries.
- PASS — retryable failures reuse leased outbox retry/backoff/dead-letter behavior.
- PASS — no chatbot, ASR, payment, dispatch, assignment, SMS, or email changes.
- PASS — automated tests inject fake providers and cannot call real FCM.

Post-design re-check: PASS. The contract, data model, and test plan preserve every gate above.

## Project Structure

### Documentation

```text
specs/010-notification-provider-delivery/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/notification-provider.md
└── tasks.md
```

### Source Code

```text
src/features/notifications/
├── notification-provider.ts
├── notification-delivery.service.ts
├── fcm-notification-provider.ts
├── notification-provider.factory.ts
└── __tests__/

src/features/outbox/
├── outbox-consumers.ts
└── outbox.route-handlers.ts

src/server/repositories/contracts/notification-delivery.repository.ts
src/server/repositories/postgres/notification-delivery.repository.ts
src/server/repositories/testing/in-memory-notification-delivery.repository.ts
src/server/repositories/**/device-delivery-credential.repository.ts
src/server/repositories/**/unit-of-work.ts
src/server/workers/outbox.worker.ts
supabase/migrations/202606250023_notification_provider_delivery.sql
```

**Structure Decision**: Extend existing notification/outbox feature modules and repository adapters; keep the external provider call outside database transactions while persisting each outcome atomically afterward.

## Complexity Tracking

No constitution violations.
