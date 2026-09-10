# Tasks: Health and Readiness

## Phase 1: Contracts

- [X] T001 [P] Add liveness/readiness service tests in `src/features/health/__tests__/health.service.test.ts`
- [X] T002 [P] Add route/status/redaction tests in `src/features/health/__tests__/health.routes.test.ts`

## Phase 2: User Story 1 - Liveness (Priority: P1)

- [X] T003 [US1] Implement dependency-free liveness in `src/features/health/health.service.ts`
- [X] T004 [US1] Implement live route handler and route in `src/features/health/health.route-handlers.ts` and `app/api/v1/internal/health/live/route.ts`

## Phase 3: User Story 2 - Readiness (Priority: P1)

- [X] T005 [US2] Implement bounded probe orchestration in `src/features/health/health.service.ts`
- [X] T006 [US2] Implement local configuration validation in `src/features/health/health-config.ts`
- [X] T007 [US2] Add PostgreSQL probe and redacted ready handler in `src/features/health/health.route-handlers.ts`
- [X] T008 [US2] Add ready route in `app/api/v1/internal/health/ready/route.ts`

## Phase 4: Validation

- [X] T009 Update `HEALTH_READINESS_TIMEOUT_MS` documentation in `.env.example` and `AGENTS.md`
- [X] T010 Run focused health tests and record `specs/015-health-readiness/validation.md`
- [X] T011 Run full unit, typecheck, lint, and build gates
- [X] T012 Review response redaction and confirm no audit/outbox/provider calls

## Dependencies

T001â€“T002 precede T003â€“T008; T009â€“T012 close the feature. Tests and implementation use different files where marked `[P]`.

