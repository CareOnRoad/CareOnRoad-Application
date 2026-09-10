# Quickstart: Rider Review and Mechanic Rating

1. Apply `202606250026_service_reviews.sql` to linked test/dev Supabase.
2. Complete an assignment and its service request through the existing state machine.
3. POST a 1-5 integer rating with the owning rider JWT and an idempotency key.
4. Retry the same payload to verify canonical replay; changed content must conflict.
5. Run the protected rebuild route with `X-Worker-Secret` to repair all aggregates.
6. Verify dispatch/mechanic/admin read models show the derived average/count.

Do not place comment text or rider identity in audit/outbox/log output.
