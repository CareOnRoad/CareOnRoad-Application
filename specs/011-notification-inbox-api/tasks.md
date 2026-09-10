# Tasks: Notification Inbox API

## Phase 1: Setup and Foundation

- [x] T001 Add unread index migration/static test in `supabase/migrations/202606250024_notification_inbox_index.sql` and `src/server/db/__tests__/notification-inbox-migration.test.ts`
- [x] T002 [P] Extend notification repository contract and in-memory/Postgres adapters for owner list/count/mark operations in `src/server/repositories/{contracts,testing,postgres}/notification.repository.ts`
- [x] T003 [P] Add repository contract tests for cursor, ownership, cutoff, idempotency, and delivery-state preservation in `src/server/repositories/testing/__tests__/notification-inbox.repository.contract.test.ts`

## Phase 2: User Story 1 — Browse Inbox (P1)

- [x] T004 [P] [US1] Add schemas/service tests for filters, cursor, pagination, mapping, and ownership in `src/features/notifications/__tests__/notification-inbox.service.test.ts`
- [x] T005 [US1] Implement schemas, opaque cursor, sanitized mapper, list, and unread count in `src/features/notifications/notification-inbox.schemas.ts` and `src/features/notifications/notification-inbox.service.ts`

## Phase 3: User Stories 2–3 — Read Mutations (P2/P3)

- [x] T006 [US2] Extend service tests and implement mark-one with first-timestamp preservation and sanitized audit in `src/features/notifications/{__tests__/notification-inbox.service.test.ts,notification-inbox.service.ts}`
- [x] T007 [US3] Extend service tests and implement cutoff-based mark-all without outbox recursion in `src/features/notifications/{__tests__/notification-inbox.service.test.ts,notification-inbox.service.ts}`

## Phase 4: API and Integration

- [x] T008 [P] [US1] [US2] [US3] Add route authorization/input/response tests in `src/features/notifications/__tests__/notification-inbox.routes.test.ts`
- [x] T009 [US1] [US2] [US3] Implement thin route handlers and four App Router endpoints in `src/features/notifications/notification-inbox.route-handlers.ts` and `app/api/v1/notifications/**/route.ts`
- [x] T010 Add PostgreSQL integration, run full quality gates, apply migration, and record `specs/011-notification-inbox-api/validation.md`

## Dependencies

- T001–T003 block service work.
- T004 precedes T005; T006–T007 extend the same service sequentially.
- T008 precedes T009; T010 validates all stories.

## Independent tests

- US1: stable owner-only pagination and unread count.
- US2: mark-one replay preserves first timestamp and delivery status.
- US3: mark-all cutoff excludes later rows and emits audit only.
