# Tasks: Notification Provider Delivery

**Input**: Design documents from `specs/010-notification-provider-delivery/`

**Tests**: Required for provider classification, deduplication, partial failure, privacy, migration, worker retry, and production wiring.

## Phase 1: Setup

- [x] T001 Add migration and static schema coverage for delivery receipts in `supabase/migrations/202606250023_notification_provider_delivery.sql` and `src/server/db/__tests__/notification-provider-delivery-migration.test.ts`

## Phase 2: Foundational

- [x] T002 [P] Define provider outcome and delivery receipt repository contracts in `src/features/notifications/notification-provider.ts` and `src/server/repositories/contracts/notification-delivery.repository.ts`
- [x] T003 Add Postgres/in-memory delivery receipt adapters, active-user credential query, and UoW wiring in `src/server/repositories/{postgres,testing,contracts}/**`

## Phase 3: User Story 1 — Deliver Active Devices (P1)

**Independent Test**: Two active devices receive one fake send each and a replay skips committed successful receipts.

- [x] T004 [P] [US1] Add fake-provider and FCM adapter classification/config/privacy tests in `src/features/notifications/__tests__/notification-provider.test.ts` and `src/features/notifications/__tests__/fcm-notification-provider.test.ts`
- [x] T005 [US1] Implement FCM HTTP v1 OAuth adapter and fail-closed factory in `src/features/notifications/fcm-notification-provider.ts` and `src/features/notifications/notification-provider.factory.ts`
- [x] T006 [P] [US1] Add delivery-service success, no-device, and replay tests in `src/features/notifications/__tests__/notification-delivery.service.test.ts`
- [x] T007 [US1] Implement encrypted credential loading and deduplicated delivery orchestration in `src/features/notifications/notification-delivery.service.ts`

## Phase 4: User Story 2 — Partial and Invalid Outcomes (P2)

**Independent Test**: Mixed success/invalid/temporary outcomes retain terminal receipts, conditionally disable the invalid version, and retry only unresolved work.

- [x] T008 [US2] Extend delivery service tests and implementation for invalidation, permanent failure, partial retry, and sanitized outcome persistence in `src/features/notifications/{__tests__/notification-delivery.service.test.ts,notification-delivery.service.ts}`

## Phase 5: User Story 3 — Production Worker Reliability (P3)

**Independent Test**: Missing configuration cannot mark sent; retryable errors back off/dead-letter and terminal failure processes without false success.

- [x] T009 [P] [US3] Add outbox consumer/worker regression tests for configured delivery, no-op prevention, retry, and terminal failure in `src/features/outbox/__tests__/outbox.worker.test.ts` and `src/features/outbox/__tests__/outbox.routes.test.ts`
- [x] T010 [US3] Wire delivery results and production provider consumer through `src/features/outbox/outbox-consumers.ts`, `src/server/workers/outbox.worker.ts`, and `src/features/outbox/outbox.route-handlers.ts`

## Phase 6: Integration and Validation

- [x] T011 Add PostgreSQL repository integration coverage in `src/server/repositories/postgres/__tests__/notification-delivery.repository.integration.test.ts`
- [x] T012 Run focused tests, PostgreSQL integration, `npm.cmd test`, typecheck, lint, and build; record evidence in `specs/010-notification-provider-delivery/validation.md`

## Dependencies & Execution Order

- T001–T003 establish storage/contracts and block all user stories.
- T004–T007 complete US1; tests precede implementation.
- T008 depends on US1 receipt orchestration.
- T009–T010 depend on the delivery service aggregate result.
- T011–T012 validate the completed feature.

## Parallel Opportunities

- T002 can be prepared independently from migration T001.
- T004 and T006 touch separate test files after foundational contracts exist.
- T009 can be written while delivery-service edge cases are finalized.

## Implementation Strategy

Deliver US1 first with fake providers, then add partial-failure semantics, then enable production worker wiring. Never configure or call a real provider during automated tests.
