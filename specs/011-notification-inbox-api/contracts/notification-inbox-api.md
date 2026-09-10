# Contract: Notification Inbox API

## GET `/api/v1/notifications`

Query: `limit` (1–100, default 20), optional opaque `cursor`, optional `unread_only=true|false`.

Response: `{ items, page: { limit, has_more, next_cursor? } }`. Each item includes ID, type, title, body, sanitized data, delivery status, read timestamp, created timestamp, and sent timestamp when present.

## GET `/api/v1/notifications/unread-count`

Response: `{ unread_count: integer }`.

## POST `/api/v1/notifications/{notificationId}/read`

Owner-only, empty body. Returns the mapped item. Replays preserve the first read timestamp.

## POST `/api/v1/notifications/read-all`

Owner-only, empty body. Returns `{ marked_read: integer, read_at: timestamp }`. Only notifications existing at the server cutoff are affected.

## Errors

- `401 UNAUTHORIZED`: missing/invalid Supabase JWT.
- `400 INVALID_INPUT`: malformed UUID, cursor, or filters.
- `404 NOT_FOUND`: absent or foreign notification without ownership disclosure.

No endpoint exposes dedupe keys, provider credentials, delivery receipts, or raw provider errors.
