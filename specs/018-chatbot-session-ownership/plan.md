# Implementation Plan: Chatbot Session Ownership

**Branch**: `feature/backend-dispatch-push-lifecycle` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

## Summary

Generate a 256-bit token at session creation, persist only SHA-256, and set an HttpOnly session-path cookie. A thin ownership service authorizes credential or claimed user identity before every session operation and supports an authenticated atomic claim endpoint.

## Technical Context

**Language/Dependencies**: Existing TypeScript, Next.js, Node crypto, Supabase JWT verifier, PostgreSQL  
**Migration**: `202606250030_chatbot_session_ownership.sql`  
**Testing**: Vitest route/security/repository and isolated PostgreSQL concurrency tests  
**Constraints**: Anonymous-first, no raw credential logs/storage, no pipeline/ASR rewrite, indistinguishable not-found denial

## Constitution Check

Passed before research and after design: backend ownership and privacy improve; safety gate, JSON validation, Vietnamese fallback, provider chain, local ASR, rate limits, and UI remain unchanged.

## Structure

```text
src/features/chatbot/session-ownership.service.ts
src/features/chatbot/api-routes.ts
src/server/repositories/contracts/chatbot-session.repository.ts
src/server/repositories/postgres/chatbot-session.repository.ts
src/features/chatbot/session.store.ts
app/api/chatbot/sessions/[sessionId]/claim/route.ts
supabase/migrations/202606250030_chatbot_session_ownership.sql
```

No constitution violations.
