# Implementation Plan: Live Location Tracking Backend

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

## Summary

Add opt-in, polling-only latest-location tracking for assignment travel states. A versioned PostgreSQL table holds one expiring point per assignment behind RLS. The assigned mechanic can transactionally overwrite it only with valid, newer, rate-compliant input; authorized readers can fetch only a non-expired latest point. A database trigger deletes the row whenever the assignment leaves `accepted`/`en_route`, and a worker-secret route cleans expired rows in bounded idempotent batches.

## Technical Context

**Language/Version**: TypeScript 5, Node.js/Next.js App Router, PostgreSQL/PostGIS  
**Primary Dependencies**: Existing Next.js, Zod, postgres client, Vitest; no new dependency  
**Storage**: Supabase PostgreSQL migration `202606250032_live_location_tracking.sql`  
**Testing**: Vitest service/route/static tests and isolated PostgreSQL integration tests  
**Target Platform**: Existing backend runtime and linked test/development Supabase  
**Project Type**: Backend feature inside existing web application  
**Performance Goals**: One bounded transaction per ingest; one-row polling reads; cleanup limit 1–100; reject updates less than 5 seconds apart  
**Constraints**: disabled by default; explicit 1–1440 minute retention; latest only; raw coordinates excluded from audit/outbox/log/errors; no SSE/WebSocket/UI/history  
**Scale/Scope**: One latest point per tracking-eligible assignment; polling MVP only

## Constitution Check

### Before research

- PASS: User explicitly authorized backend live tracking; frontend/live tracking UI remains excluded.
- PASS: Strict actor, ownership, object, lifecycle, and RLS requirements are specified.
- PASS: No payment/chatbot/ASR/AI behavior or automatic workflow transition is added.
- PASS: No unsafe retention default; feature cannot ingest without explicit approved retention.
- PASS: Versioned migration, repository boundaries, concurrency, worker protection, and privacy tests are required.

### After design

- PASS: Database primary key and assignment row lock enforce one latest row and serialize competing updates.
- PASS: Database trigger deletes coordinates when travel eligibility ends, independent of application path.
- PASS: Read predicates exclude expired and non-travel data; cleanup is bounded and idempotent.
- PASS: Audit/outbox are deliberately omitted for high-frequency points; worker summaries contain counts only.
- PASS: RLS exposes no direct client policy; authenticated backend authorization remains mandatory.

## Project Structure

```text
app/api/v1/assignments/[assignmentId]/live-location/route.ts
app/api/v1/internal/workers/live-locations/cleanup/route.ts
src/features/live-tracking/
  live-tracking.schemas.ts
  live-tracking.service.ts
  live-tracking.route-handlers.ts
  live-tracking-cleanup.worker.ts
  live-tracking-cleanup.route-handlers.ts
  __tests__/*.test.ts
src/server/repositories/contracts/live-tracking.repository.ts
src/server/repositories/postgres/live-tracking.repository.ts
src/server/repositories/testing/in-memory-live-tracking.repository.ts
supabase/migrations/202606250032_live_location_tracking.sql
```

**Structure Decision**: Keep HTTP parsing/auth mapping thin; business privacy and lifecycle rules live in the feature service; contested writes and deletes live behind a repository and database constraints/trigger.

## Design Decisions

- Ingest/read endpoint: `PUT|GET /api/v1/assignments/{assignmentId}/live-location`.
- Cleanup endpoint: `POST /api/v1/internal/workers/live-locations/cleanup` with `{limit}`.
- Eligible assignment states: `accepted`, `en_route` only.
- Input bounds: latitude/longitude valid, accuracy 0–100m, observed time age <=30s and future skew <=5s.
- Replay/rate rule: observed time must increase; server receipt times must be >=5s apart.
- Retention: `LIVE_TRACKING_RETENTION_MINUTES` required only when `LIVE_TRACKING_ENABLED=true`; absent/invalid prevents ingest.
- Table stores PostGIS point and exposes latitude/longitude only through repository mapping.
- No audit/outbox per coordinate update. Cleanup summaries return counts only.

## Complexity Tracking

No constitution violation. The new high-privacy backend scope is explicitly authorized by the user and bounded to polling/latest-only behavior.
