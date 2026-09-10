# Implementation Plan: CareOnRoad Payment

**Branch**: `005-careonroad-payment` | **Date**: 2026-07-08
**Spec**: [spec.md](spec.md)

## Summary

Implement backend-only payOS/VietQR payment order creation, webhook processing,
pending-order reconciliation, persistence, audit/outbox, and assignment start
gating. Use no new runtime dependency; use native `fetch` and `node:crypto`.

## Technical Context

- Existing Next.js App Router backend, TypeScript, Zod, Vitest.
- Existing Supabase PostgreSQL repository/unit-of-work pattern.
- payOS creates VietQR checkout/QR data and sends signed webhooks.
- payOS has no dedicated sandbox; automated tests must mock provider behavior.

## Public API Additions

- `POST /api/v1/payments/orders`: rider-owned payment order creation for an
  approved quote. Requires `X-Idempotency-Key`.
- `GET /api/v1/payments/orders/[paymentOrderId]`: visible to owning rider,
  assigned mechanic, or admin.
- `POST /api/v1/payments/orders/[paymentOrderId]/cancel`: owning rider can
  cancel created/pending/failed orders.
- `POST /api/v1/payments/webhooks/payos`: validates payOS signature, dedupes
  events, and updates payment order status.
- `POST /api/v1/internal/workers/payments/reconcile`: worker-secret protected
  recovery for stale pending orders.

## Architecture Decisions

- Payment provider boundary lives in `src/features/payments/payment-provider.ts`.
- payOS implementation lives in `src/features/payments/payos.client.ts`.
- Payment domain behavior lives in `src/features/payments/payment.service.ts`.
- Persistence lives behind `PaymentRepository`.
- Migration `202606250020_payments.sql` is additive after mechanic operations.
- `awaiting_payment -> in_progress` stays in assignment status route but now
  checks for a succeeded payment order.

## Out Of Scope

No frontend payment page, refunds, payout, settlement, invoices, tax, provider
management UI, admin payment UI, card storage, inventory, Maps/tracking,
chatbot, or ASR changes.
