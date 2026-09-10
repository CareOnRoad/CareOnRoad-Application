# Quickstart: Distributed Runtime Controls

1. In default memory mode, run existing chatbot rate/circuit tests and confirm unchanged behavior.
2. Apply migrations through `202606250029_distributed_runtime_controls.sql` on a test database.
3. Enable PostgreSQL mode and run runtime-control integration tests.
4. Confirm two adapters share counts/circuit state, expiry resets state, failure uses local fallback, and stored keys are opaque.
5. Run unit, DB, typecheck, lint, and build gates from `AGENTS.md`.
