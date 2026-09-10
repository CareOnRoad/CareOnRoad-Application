# Implementation Plan: Route ETA Provider

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

## Summary

Add a provider-neutral, authenticated route ETA read service for active assignments. The first adapter calls Google Routes `ComputeRoutes` with `TWO_WHEELER`, a narrow response field mask, a bounded timeout, and a server-only API key. The service re-checks authorization and workflow state on every call, uses only fresh mechanic coordinates and stored service coordinates, deduplicates concurrent requests, caches valid results briefly, and returns a labelled straight-line-distance fallback when routing is unavailable.

## Technical Context

**Language/Version**: TypeScript 5 on Node.js/Next.js App Router  
**Primary Dependencies**: Existing React 19, Next.js, Zod, native `fetch`, Vitest; no new package  
**Storage**: Existing Supabase PostgreSQL read models; no schema change  
**Testing**: Vitest unit/static/route tests with fake provider; no real Google call  
**Target Platform**: Existing local/server Next.js backend runtime  
**Project Type**: Web application with thin App Router handlers and feature services  
**Performance Goals**: Provider timeout configurable from 1–10 seconds; equivalent concurrent calls collapse to one; cache TTL configurable from 5–300 seconds  
**Constraints**: backend-only secret; active assignments only; location freshness; no geocoding/polyline/UI/history; no state mutation; controlled fallback  
**Scale/Scope**: One origin and destination per request; process-local cache for advisory P2 MVP

## Constitution Check

### Before research

- PASS: Backend-only scope; no frontend or live-tracking UI.
- PASS: Authenticated identity, RBAC, ownership, and object authorization are required.
- PASS: No workflow mutation or payment/chatbot/ASR behavior is introduced.
- PASS: Provider key stays server-side and provider payloads are not logged or returned.
- PASS: Existing repositories remain the source for assignment, mechanic, and request state.

### After design

- PASS: Every request re-evaluates authorization and assignment state before cache/provider use.
- PASS: Provider failures are contained behind a controlled neutral contract.
- PASS: Fake-provider tests cover success, failure classification, dedupe, cache, and privacy boundaries.
- PASS: Google two-wheeler beta/coverage warning is carried as advisory metadata.

## Project Structure

```text
app/api/v1/assignments/[assignmentId]/route-eta/route.ts
src/features/route-eta/
  route-eta.types.ts
  route-eta.provider.ts
  google-routes.provider.ts
  route-eta.cache.ts
  route-eta.service.ts
  route-eta.route-handlers.ts
  __tests__/*.test.ts
```

**Structure Decision**: Keep route files thin and isolate provider, cache, authorization/service, and route orchestration under `src/features/route-eta`. Reuse existing repositories; no migration or new repository is required.

## Design Decisions

- Endpoint: `GET /api/v1/assignments/{assignmentId}/route-eta`.
- Readers: owning rider, assigned mechanic, or admin; inactive users are rejected.
- Active states: existing `ACTIVE_ASSIGNMENT_STATUSES` is authoritative.
- Freshness default: 300 seconds, configurable with `ROUTE_ETA_LOCATION_MAX_AGE_SECONDS`.
- Provider: `ROUTE_ETA_PROVIDER=google_routes`; missing/disabled configuration yields controlled fallback.
- Cache: bounded process-local TTL map keyed by assignment and coordinate snapshot; auth/state checks happen first.
- Fallback: Haversine straight-line distance, no duration, source `straight_line_fallback`, safe reason code.

## Complexity Tracking

No constitution violations or justified exceptions.
