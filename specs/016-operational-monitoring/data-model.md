# Data Model: Operational Monitoring

## Worker Run Record

- `id` UUID primary key
- `worker_name` bounded text
- `status`: `succeeded | failed`
- `error_code` optional normalized text
- `items_claimed`, `items_succeeded`, `items_failed`: non-negative integers
- `started_at`, `completed_at`, `created_at`
- append-only trigger; RLS enabled; indexes `(worker_name, completed_at desc, id)` and `(completed_at desc, id)`

Other queue items are read models projected from existing outbox, payment, request, and dispatch tables.
