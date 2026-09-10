import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedPostgresTestContext, hasPostgresTestDatabase, type IsolatedPostgresTestContext } from "@/server/testing/postgres-test-context";
import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrations = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations")).filter((name) => name.endsWith(".sql")).sort();

describeDatabase("operational monitoring repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(); sql = context.sql;
    for (const migration of migrations) await sql.unsafe(readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migration), "utf8"));
  }, 120_000);
  afterAll(async () => { await context?.dispose(); }, 30_000);

  it("appends, cursor-pages and enforces append-only worker records", async () => {
    const unit = new PostgresUnitOfWork(sql);
    const ids = [randomUUID(), randomUUID()];
    for (const [index, id] of ids.entries()) await unit.execute(({ operationalMonitoring }) => operationalMonitoring.appendWorkerRun({
      id, workerName: "dispatch", status: "succeeded", itemsClaimed: 1, itemsSucceeded: 1, itemsFailed: 0,
      startedAt: new Date(`2026-08-23T00:00:0${index}Z`), completedAt: new Date(`2026-08-23T00:00:1${index}Z`)
    }));
    const first = await unit.execute(({ operationalMonitoring }) => operationalMonitoring.listWorkerRuns({ limit: 1 }));
    const second = await unit.execute(({ operationalMonitoring }) => operationalMonitoring.listWorkerRuns({ limit: 1, cursor: { createdAt: first[0].completedAt, id: first[0].id } }));
    expect(first[0].id).not.toBe(second[0].id);
    await expect(sql`update worker_run_records set worker_name = 'changed' where id = ${ids[0]}`).rejects.toThrow(/append-only/i);
  });
});
