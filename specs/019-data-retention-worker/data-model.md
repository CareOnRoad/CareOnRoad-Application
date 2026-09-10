# Data Model

## Retention lease

- Fixed worker name primary key, lease owner, lease expiry, update timestamp.
- Atomic claim succeeds when absent, expired, or already held by the same worker.

## Policy (configuration only)

- Enabled boolean (default false).
- Optional positive day count for each allowlisted class.
- Batch limit 1–100 and dry-run boolean (default true) are request controls.

No retention policy values are stored in business tables.
