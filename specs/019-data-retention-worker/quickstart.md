# Quickstart

1. Leave retention variables absent and run the protected route: all classes are skipped.
2. Set class periods but leave execution disabled; run default dry-run and verify bounded eligible summaries and zero deletion.
3. On an isolated test database only, enable execution and send `dry_run=false`; verify exact old allowlisted rows are removed.
4. Repeat and verify zero deletion; run two workers concurrently and verify one lease holder.
5. Run all unit, DB, typecheck, lint, and build gates.
