import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../../repositories/postgres/postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = [
  "202606250001_enable_extensions.sql",
  "202606250002_outbox_audit_idempotency.sql",
  "202606250003_rls_foundation.sql"
];

describeDatabase("foundation migrations integration", () => {
  let sql: Sql;
  let context: IsolatedPostgresTestContext;

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext();
    sql = context.sql;
  });

  afterAll(async () => {
    await context?.dispose();
  });

  it("applies in order and rolls back transactionally", async () => {
    const rollbackMarker = new Error("ROLLBACK_FOUNDATION_MIGRATIONS");

    await expect(
      sql.begin(async (transaction) => {
        await applyMigrations(transaction);
        const rows = await transaction<{ table_name: string }[]>`
          select table_name
          from information_schema.tables
          where table_schema = ${context.schema}
            and table_name in ('idempotency_records', 'outbox_events', 'audit_logs')
          order by table_name
        `;
        expect(rows.map((row) => row.table_name)).toEqual([
          "audit_logs",
          "idempotency_records",
          "outbox_events"
        ]);
        throw rollbackMarker;
      })
    ).rejects.toBe(rollbackMarker);

    const rows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = ${context.schema}
        and table_name in ('idempotency_records', 'outbox_events', 'audit_logs')
    `;
    expect(rows).toHaveLength(0);
  });

  it("rolls back idempotency, outbox, and audit writes atomically", async () => {
    await applyMigrations(sql);
    const unitOfWork = new PostgresUnitOfWork(sql);

    await expect(
      unitOfWork.execute(async ({ audit, idempotency, outbox }) => {
        await idempotency.create({
          id: "11111111-1111-4111-8111-111111111111",
          actorId: "22222222-2222-4222-8222-222222222222",
          scope: "integration.test",
          idempotencyKey: "rollback-key",
          requestHash: "a".repeat(64),
          expiresAt: new Date("2026-06-26T00:00:00.000Z")
        });
        await outbox.append({
          id: "33333333-3333-4333-8333-333333333333",
          topic: "integration.test",
          aggregateType: "test",
          aggregateId: "44444444-4444-4444-8444-444444444444",
          dedupeKey: "integration:test:rollback",
          payload: {}
        });
        await audit.append({
          id: "55555555-5555-4555-8555-555555555555",
          actorId: "22222222-2222-4222-8222-222222222222",
          actorRole: "rider",
          action: "integration.test",
          entityType: "test",
          entityId: "44444444-4444-4444-8444-444444444444",
          metadata: { status: "created" }
        });
        throw new Error("ROLLBACK_FOUNDATION_WRITES");
      })
    ).rejects.toThrow("ROLLBACK_FOUNDATION_WRITES");

    const [idempotencyRows, outboxRows, auditRows] = await Promise.all([
      sql`select id from idempotency_records`,
      sql`select id from outbox_events`,
      sql`select id from audit_logs`
    ]);
    expect(idempotencyRows).toHaveLength(0);
    expect(outboxRows).toHaveLength(0);
    expect(auditRows).toHaveLength(0);
  });
});

async function applyMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  for (const migrationFile of migrationFiles) {
    const migrationSql = readFileSync(
      resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile),
      "utf8"
    );
    await sql.unsafe(migrationSql);
  }
}
