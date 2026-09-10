# Implementation Plan: Data Retention Worker

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

## Summary

Add a worker-secret-protected, lease-based retention service with default dry-run and an explicit execution gate. A dedicated repository exposes only three allowlisted per-class count/delete operations; configuration supplies optional class periods with no destructive defaults.

## Technical Context

**Stack**: Existing TypeScript/Next.js/PostgreSQL/Vitest  
**Migration**: `202606250031_data_retention_worker.sql`  
**Route**: `POST /api/v1/internal/workers/retention/run`  
**Constraints**: no dependencies; 1–100/class; redacted summary; no raw media deletion; audit/payment/business tables excluded

## Constitution Check

Passed before research and after design. The feature is internal operational hygiene, preserves all chatbot/ASR/safety/payment workflows, uses explicit persistence boundaries, and adds no UI/provider.

## Structure

```text
src/features/retention/{retention-policy.ts,retention.route-handlers.ts}
src/server/repositories/contracts/retention.repository.ts
src/server/repositories/postgres/retention.repository.ts
src/server/workers/retention.worker.ts
app/api/v1/internal/workers/retention/run/route.ts
supabase/migrations/202606250031_data_retention_worker.sql
```

No constitution violations.
