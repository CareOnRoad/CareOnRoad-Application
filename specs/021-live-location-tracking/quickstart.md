# Quickstart: Live Location Tracking Backend

1. Apply migration `202606250032_live_location_tracking.sql` to an isolated test/development database.
2. Leave `LIVE_TRACKING_ENABLED=false`: ingest must return a controlled conflict and write nothing.
3. Set `LIVE_TRACKING_ENABLED=true` and an explicitly approved `LIVE_TRACKING_RETENTION_MINUTES=1..1440` in server secret/config storage.
4. As the assigned mechanic on an `accepted`/`en_route` assignment, PUT a fresh accurate location; poll it as owner, assigned mechanic, and admin.
5. Attempt cross-assignment write/read, replay, old/future timestamp, inaccurate point, and sub-5-second update; all must be rejected without replacing current data.
6. Transition assignment to `on_site`, completed, canceled, or recovery-canceled and verify the database trigger removes the point.
7. Insert an expired test row and run the worker-secret cleanup route twice; first run deletes within limit, second is idempotent.
8. Run unit, isolated PostgreSQL integration, typecheck, lint, and build validation. Inspect output/diff for raw coordinates or secrets.
