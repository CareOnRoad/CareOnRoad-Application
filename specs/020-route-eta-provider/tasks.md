# Tasks: Route ETA Provider

## Phase 1: Setup

- [x] T001 Add documented route ETA server configuration to `.env.example`
- [x] T002 [P] Add provider-neutral route ETA types and failure taxonomy in `src/features/route-eta/route-eta.types.ts` and `src/features/route-eta/route-eta.provider.ts`

## Phase 2: Foundational

- [x] T003 [P] Write Google adapter success/error/timeout/malformed tests in `src/features/route-eta/__tests__/google-routes.provider.test.ts`
- [x] T004 Implement config validation, disabled adapter, and Google Routes adapter in `src/features/route-eta/route-eta.provider.ts` and `src/features/route-eta/google-routes.provider.ts`
- [x] T005 [P] Write TTL-cache and concurrent-deduplication tests in `src/features/route-eta/__tests__/route-eta.cache.test.ts`
- [x] T006 Implement bounded TTL cache and in-flight deduplication in `src/features/route-eta/route-eta.cache.ts`

## Phase 3: User Story 1 - Authorized active-assignment ETA

**Independent Test**: Owner rider, assigned mechanic, and admin receive an available route estimate; unrelated actors and terminal assignments are rejected before provider use.

- [x] T007 [US1] Write authorization, active-state, origin/destination, and provider-success service tests in `src/features/route-eta/__tests__/route-eta.service.test.ts`
- [x] T008 [US1] Implement authorized active-assignment ETA orchestration in `src/features/route-eta/route-eta.service.ts`
- [x] T009 [US1] Write authenticated endpoint contract tests in `src/features/route-eta/__tests__/route-eta.routes.test.ts`
- [x] T010 [US1] Add thin route handler and GET endpoint in `src/features/route-eta/route-eta.route-handlers.ts` and `app/api/v1/assignments/[assignmentId]/route-eta/route.ts`

## Phase 4: User Story 2 - Controlled provider fallback

**Independent Test**: Disabled, timeout, quota, authentication, network, server, no-route, and malformed provider cases return a labelled fallback with distance only, or unavailable when coordinates are missing/stale.

- [x] T011 [US2] Add fallback, stale/missing coordinate, cache-expiry, and concurrent request coverage in `src/features/route-eta/__tests__/route-eta.service.test.ts`
- [x] T012 [US2] Finalize Haversine fallback, safe reason mapping, advisory warning, and no-state-mutation behavior in `src/features/route-eta/route-eta.service.ts`

## Phase 5: Polish and Cross-Cutting Validation

- [x] T013 [P] Add static secret/scope checks and API inventory coverage in `src/features/route-eta/__tests__/route-eta.scope.static.test.ts`
- [x] T014 Update backend status, route, and environment documentation in `AGENTS.md`
- [x] T015 Run focused/unit/typecheck/lint/build validation and record results in `specs/020-route-eta-provider/validation.md`

## Dependencies

T001–T002 → T003–T006 → T007–T010 → T011–T012 → T013–T015.

## Parallel Opportunities

- T001 and T002 touch independent configuration/type files.
- T003 and T005 are independent test-first tasks.
- T013 can be prepared independently after the endpoint contract stabilizes.

## Implementation Strategy

Complete provider/config and cache foundations first, deliver the authorized successful ETA story, then add failure fallback and final scope/secret validation. Tests precede each implementation group and no test calls the real provider.
