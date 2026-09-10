# Quickstart: Route ETA Provider

1. Configure `ROUTE_ETA_PROVIDER=google_routes` and `GOOGLE_ROUTES_API_KEY` only in server secret storage.
2. Keep an active assignment whose mechanic location is fresh and request location exists.
3. Call `GET /api/v1/assignments/{assignmentId}/route-eta` as owner, assigned mechanic, and admin.
4. Call as an unrelated actor and on a terminal assignment; expect rejection before provider use.
5. Disable provider or use fake timeout/quota adapters; expect labelled straight-line fallback without duration.
6. Issue simultaneous/repeated calls inside and outside TTL; verify dedupe, cache reuse, and expiry.
7. Run unit, typecheck, lint, and build gates; tests must never call real Google Routes.
