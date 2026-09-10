# Implementation Plan: Notification Inbox API

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

## Summary

Extend the existing notification repository with owner-scoped cursor list/count/read operations, add a notification inbox service with opaque cursors and sanitized response mapping, and expose four thin authenticated routes. Add one partial unread index migration.

## Technical Context

**Language/Version**: TypeScript 5, Node.js, Next.js 15 App Router

**Primary Dependencies**: Existing Zod, Supabase authentication, Postgres repository/UoW

**Storage**: Existing `notifications.read_at` plus migration `202606250024_notification_inbox_index.sql`

**Testing**: Vitest service/route/static tests and PostgreSQL integration

**Target Platform**: Authenticated backend APIs

**Performance Goals**: Page limit 1–100; indexed unread count and newest-first pagination

**Constraints**: No frontend/preferences; no cross-user admin access; no outbox on read mutation

**Scale/Scope**: Per-user inbox for existing persisted notifications

## Constitution Check

- PASS — authenticated owner-only backend scope and no frontend.
- PASS — cursor and mutations use repositories/UoW; audit contains IDs/counts only.
- PASS — delivery status is independent and unchanged by read state.
- PASS — no recursive notification/outbox emission.
- PASS — chatbot, ASR, payment, dispatch, and provider delivery remain unchanged.

Post-design re-check: PASS.

## Project Structure

```text
specs/011-notification-inbox-api/{spec,plan,research,data-model,quickstart,tasks}.md
specs/011-notification-inbox-api/contracts/notification-inbox-api.md
src/features/notifications/notification-inbox.{schemas,service,route-handlers}.ts
src/features/notifications/__tests__/notification-inbox.*.test.ts
src/server/repositories/{contracts,postgres,testing}/notification.repository.ts
app/api/v1/notifications/**/route.ts
supabase/migrations/202606250024_notification_inbox_index.sql
```

**Structure Decision**: Keep all inbox behavior inside the existing notifications feature and extend the existing notification repository rather than introduce a parallel read model.

## Complexity Tracking

No constitution violations.
