# Data Model: Notification Inbox API

## Existing Notification read state

- `user_id`: immutable owner used by every inbox query/update.
- `read_at`: null for unread; first server timestamp for read.
- `status`, `sent_at`, `last_error_code`: delivery fields, never mutated by inbox commands.
- `created_at`, `id`: stable descending cursor pair.

## Index

- Partial index on `(user_id, created_at desc, id desc)` where `read_at is null` supports unread list/count.

## Mutation invariants

- Mark-one changes only `read_at` and only when null.
- Mark-all changes only caller-owned rows with null `read_at` and `created_at <= cutoff`.
- Audit is append-only and contains no notification title/body/data.
