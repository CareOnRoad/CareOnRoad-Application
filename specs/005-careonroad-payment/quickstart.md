# Quickstart: Payment Validation

## Automated

```powershell
npm.cmd test -- src/features/payments/__tests__/payos-signature.test.ts src/features/payments/__tests__/payment.service.test.ts
npm.cmd test -- src/server/db/__tests__/payment-migration.test.ts src/server/db/__tests__/all-migrations.static.test.ts
npm.cmd run typecheck
```

## Manual Hosted/Dev

Use only a linked test/development Supabase project and a payOS account intended
for testing with very small VND amounts.

1. Apply migrations through `202606250020_payments.sql`.
2. Configure backend-only payOS environment variables.
3. Create a service request, dispatch, assignment, diagnosis, quote, and approve
   the quote.
4. Call `POST /api/v1/payments/orders` with the approved `quote_id` and
   `X-Idempotency-Key`.
5. Open returned `checkout_url` or scan returned `qr_code`.
6. Pay a small amount.
7. Confirm payOS webhook marks payment `succeeded`.
8. Call assignment status route with `{"status":"in_progress"}` as mechanic or
   admin and verify it succeeds only after payment success.

Do not paste payOS keys, database URLs, service-role keys, raw webhook payloads,
or bank account details into committed docs.
