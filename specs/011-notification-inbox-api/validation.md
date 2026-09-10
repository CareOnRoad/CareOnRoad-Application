# Validation: Notification Inbox API

## Result

Feature 6 is complete. The inbox is owner-scoped, paginated with an opaque cursor,
and supports unread count, idempotent mark-one, and cutoff-based mark-all without
altering provider delivery state or creating notification outbox recursion.

## Evidence

- Focused repository, migration, service, and route tests: 13 passed.
- PostgreSQL notification inbox integration: 1 passed.
- Full unit/static/route suite: 414 passed across 122 files.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed; all four inbox routes were emitted.
- Supabase dry-run listed only `202606250024_notification_inbox_index.sql`.
- Supabase push applied migration `202606250024`.
- Final migration list shows local and remote versions aligned through
  `202606250024`.

## Security checks

- Queries bind ownership to the authenticated actor subject.
- Admin role does not grant implicit cross-user inbox access.
- API responses omit delivery errors, dedupe keys, and internal metadata.
- Read operations preserve the first `read_at` timestamp and provider delivery
  state.
- Mark-all uses a request-time cutoff so newer notifications are not changed.
