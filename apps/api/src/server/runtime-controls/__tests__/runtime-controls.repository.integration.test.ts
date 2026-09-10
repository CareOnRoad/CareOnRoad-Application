import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedPostgresTestContext, hasPostgresTestDatabase, type IsolatedPostgresTestContext } from "@/server/testing/postgres-test-context";
import { PostgresRuntimeControlStore } from "../postgres-runtime-control.store";

const describeDb = hasPostgresTestDatabase() ? describe : describe.skip;
const migrations = readdirSync(resolve(process.cwd(), "../../supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
describeDb("distributed runtime controls integration", () => {
  let context: IsolatedPostgresTestContext; let store: PostgresRuntimeControlStore;
  beforeAll(async () => { context = await createIsolatedPostgresTestContext(); for (const file of migrations) await context.sql.unsafe(readFileSync(resolve(process.cwd(), "../../supabase/migrations", file), "utf8")); store = new PostgresRuntimeControlStore(context.sql); }, 120_000);
  afterAll(async () => { await context?.dispose(); }, 30_000);
  it("atomically coordinates buckets and circuits", async () => {
    const keyHash = createHash("sha256").update(randomUUID()).digest("hex"); const now = Date.now();
    const buckets = await Promise.all(Array.from({ length: 10 }, () => store.consumeRateBucket({ keyHash, scope: "session", limit: 5, windowMs: 60_000, now })));
    expect(Math.max(...buckets.map((item) => item.count))).toBe(10);
    await Promise.all(Array.from({ length: 3 }, () => store.recordCircuitFailure({ provider: "gemini", threshold: 3, cooldownMs: 60_000, now })));
    await expect(store.isCircuitOpen("gemini", now)).resolves.toBe(true);
    await store.recordCircuitSuccess("gemini"); await expect(store.isCircuitOpen("gemini", now)).resolves.toBe(false);
  });
});
