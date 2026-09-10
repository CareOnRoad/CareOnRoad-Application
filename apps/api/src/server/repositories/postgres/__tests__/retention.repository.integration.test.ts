import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedPostgresTestContext, hasPostgresTestDatabase, type IsolatedPostgresTestContext } from "@/server/testing/postgres-test-context";
import { PostgresRetentionRepository } from "../retention.repository";
const describeDb = hasPostgresTestDatabase() ? describe : describe.skip;
const migrations = readdirSync(resolve(process.cwd(), "../../supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
describeDb("retention repository integration", () => {
  let context: IsolatedPostgresTestContext; let repo: PostgresRetentionRepository;
  beforeAll(async () => { context = await createIsolatedPostgresTestContext(); for (const file of migrations) await context.sql.unsafe(readFileSync(resolve(process.cwd(), "../../supabase/migrations", file), "utf8")); repo = new PostgresRetentionRepository(context.sql); }, 120_000);
  afterAll(async () => { await context?.dispose(); }, 30_000);
  it("leases once and performs bounded idempotent cutoff deletion", async () => { const now = new Date("2026-08-23T00:00:00Z"); const claims = await Promise.all(["a", "b"].map((workerId) => repo.claimLease({ workerId, now, leaseExpiresAt: new Date(now.getTime() + 60_000) }))); expect(claims.filter(Boolean)).toHaveLength(1); await repo.releaseLease(claims[0] ? "a" : "b"); for (let index = 0; index < 3; index += 1) await context.sql`insert into worker_run_records (id, worker_name, status, items_claimed, items_succeeded, items_failed, started_at, completed_at) values (${randomUUID()}, 'test', 'succeeded', 0, 0, 0, ${new Date("2026-01-01T00:00:00Z")}, ${new Date(`2026-01-01T00:00:0${index}Z`)})`; await expect(repo.countEligible("worker_runs", new Date("2026-02-01"), 2)).resolves.toBe(2); await expect(repo.deleteEligible("worker_runs", new Date("2026-02-01"), 2)).resolves.toBe(2); await expect(repo.deleteEligible("worker_runs", new Date("2026-02-01"), 2)).resolves.toBe(1); await expect(repo.deleteEligible("worker_runs", new Date("2026-02-01"), 2)).resolves.toBe(0); }, 90_000);
});
