# Data Model: Live Location Tracking

## `assignment_live_locations`

- `assignment_id uuid` primary key and foreign key to `assignments(id)` with cascade delete.
- `mechanic_id uuid` foreign key to `mechanic_profiles(user_id)`.
- `location geography(Point,4326)` required.
- `observed_at timestamptz` client observation time.
- `accuracy_meters numeric(6,2)` constrained from 0 through 100.
- `received_at timestamptz` server receipt/rate-limit time.
- `expires_at timestamptz` required and greater than receipt time.
- `created_at`, `updated_at` server timestamps.

### Invariants

- Primary key permits one latest point per assignment.
- Service transaction locks assignment and latest row before overwrite.
- Mechanic must equal assignment mechanic; assignment must be `accepted`/`en_route`.
- New observed time is strictly greater than stored time.
- New received time is at least configured interval after prior receipt.
- Database trigger deletes row when assignment status leaves travel states.
- Expiry index supports bounded cleanup.
- RLS enabled; no direct client policy.

## Tracking configuration (server-only)

- Enabled boolean, default false.
- Explicit retention minutes, no default when enabled.
- Fixed safe validation defaults: max age 30s, future skew 5s, accuracy 100m, minimum interval 5s.
