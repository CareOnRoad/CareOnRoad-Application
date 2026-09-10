# Research: Cancel Request Closes Dispatch

## Findings

- Admin cancellation already reconciles open rounds/candidates, but rider
  cancellation only changes the request and leaves live offers behind.
- Offer acceptance currently locks candidate before request, while cancellation
  locks request before candidate, creating inverse lock order.
- Mechanic offer listing already filters to `status = offered`; changing the
  candidate status is enough to remove canceled offers.
- UnitOfWork rollback already covers request/history/audit/outbox and dispatch rows.

## Decisions

- Normalize both paths to request-before-candidate locking by using a non-locking
  candidate lookup before acceptance locks the request and revalidates the
  candidate under lock.
- Encapsulate set-based dispatch closure in DispatchRepository and reuse it for
  rider/admin cancellation.
- Keep rider terminal retry as controlled conflict/no mutation and admin replay
  through its existing idempotency record.
- No migration: existing status columns, request foreign keys, and indexes suffice.
