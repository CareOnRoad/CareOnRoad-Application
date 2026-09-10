import { readFileSync, readdirSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";

import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase
} from "@/server/testing/postgres-test-context";
import { PostgresUnitOfWork } from "@/server/repositories/postgres/postgres-unit-of-work";
import { OutboxWorker } from "@/server/workers/outbox.worker";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationsDirectory = resolve(process.cwd(), "..", "..", "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const now = new Date("2026-06-30T07:00:00.000Z");

describeDatabase("outbox worker peer-claim local regression smoke", () => {
  it("lets two peers claim and process 20 leased events without blocking", async () => {
    const context = await createIsolatedPostgresTestContext(process.env, {
      maxConnections: 6
    });

    try {
      await applyMigrations(context.sql);
      await seedEvents(context.sql);
      const deliveredBy = new Map<string, string>();
      const worker = (workerId: string) =>
        new OutboxWorker(new PostgresUnitOfWork(context.sql), {
          now: () => now,
          workerId,
          batchSize: 10,
          consumers: {
            defaultHandler: async (event) => {
              deliveredBy.set(event.id, workerId);
              await Promise.resolve();
            }
          }
        });

      const startedAt = performance.now();
      const [first, second] = await Promise.all([
        worker("peer-a").processBatch(),
        worker("peer-b").processBatch()
      ]);
      const elapsedMs = performance.now() - startedAt;

      expect(elapsedMs).toBeLessThan(30_000);
      expect(first.claimed).toBeGreaterThan(0);
      expect(second.claimed).toBeGreaterThan(0);
      expect(first.claimed + second.claimed).toBe(20);
      expect(first.processed + second.processed).toBe(20);
      expect(new Set(deliveredBy.values())).toEqual(new Set(["peer-a", "peer-b"]));

      const rows = await context.sql<{
        status: string;
        count: number;
        leased: number;
      }[]>`
        select
          status::text,
          count(*)::int as count,
          count(*) filter (
            where lease_owner is not null or lease_expires_at is not null
          )::int as leased
        from outbox_events
        group by status
      `;
      expect(rows).toEqual([{ status: "processed", count: 20, leased: 0 }]);
    } finally {
      await context.dispose();
    }
  }, 120_000);
});

async function seedEvents(sql: Sql) {
  for (let index = 1; index <= 20; index += 1) {
    const id = uuid(index);
    await sql`
      insert into outbox_events (
        id, topic, aggregate_type, aggregate_id, dedupe_key, payload,
        status, attempt_count, next_attempt_at, created_at
      )
      values (
        ${id}, 'smoke.event', 'smoke', ${id}, ${`smoke.event:${index}`},
        ${sql.json({ resource_id: id, status: "queued" })},
        'pending', 0, ${now}, ${new Date(now.getTime() + index)}
      )
    `;
  }
}

async function applyMigrations(sql: Pick<Sql, "unsafe">) {
  for (const migrationFile of migrationFiles) {
    await sql.unsafe(readFileSync(resolve(migrationsDirectory, migrationFile), "utf8"));
  }
}

function uuid(index: number): string {
  return `30000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}
