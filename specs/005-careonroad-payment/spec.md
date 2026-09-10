# Feature Specification: CareOnRoad Payment

**Feature Branch**: `005-careonroad-payment`
**Created**: 2026-07-08
**Status**: Implemented in workspace

## Summary

Add backend-only payment APIs for approved CareOnRoad quotes using payOS with
VietQR checkout/QR data. The feature is API and documentation only: no rider
checkout UI, admin UI, refunds, settlement, payout, invoices, inventory, Maps,
tracking, chatbot, or ASR changes.

## Requirements

- Riders can create one active payment order for their latest approved quote
  when request and assignment are both `awaiting_payment`.
- Payment order creation requires `X-Idempotency-Key`.
- payOS creates the payment link and VietQR QR payload.
- payOS webhook is the only automated authority that can mark payment
  `succeeded`.
- Return/cancel browser redirects are not authoritative.
- A succeeded payment enables, but does not automatically perform, assignment
  `awaiting_payment -> in_progress`.
- Amount/currency/provider mismatches move the order to `needs_review` and do
  not advance workflow.
- All audit/outbox payloads are sanitized metadata only.

## API Surface

- `POST /api/v1/payments/orders`
- `GET /api/v1/payments/orders/[paymentOrderId]`
- `POST /api/v1/payments/orders/[paymentOrderId]/cancel`
- `POST /api/v1/payments/webhooks/payos`
- `POST /api/v1/internal/workers/payments/reconcile`

## Success Criteria

- Payment order creation returns payOS checkout URL and QR payload.
- Verified webhook marks matching payment as `succeeded`.
- Duplicate webhooks do not duplicate state, audit, or outbox.
- Assignment cannot start before payment success and can start after payment
  success.
- Tests never call real payOS.
