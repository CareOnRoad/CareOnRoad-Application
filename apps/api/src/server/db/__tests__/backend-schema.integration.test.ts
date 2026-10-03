import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertBackendSchema, checkBackendSchema } from "../backend-schema.mjs";
import { cleanupPostgresTables, createIsolatedPostgresTestContext, hasPostgresTestDatabase, type IsolatedPostgresTestContext } from "@/server/testing/postgres-test-context";
import { PostgresAssignmentRepository } from "@/server/repositories/postgres/assignment.repository";
import { PostgresNotificationDeliveryRepository } from "@/server/repositories/postgres/notification-delivery.repository";

describe.skipIf(!hasPostgresTestDatabase())("schema 035 PostgreSQL smoke", () => {
  let context: IsolatedPostgresTestContext;
  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext();
    const directory = resolve(process.cwd(), "../../supabase/migrations");
    for (const file of readdirSync(directory).filter(file => file.endsWith(".sql")).sort()) {
      await context.sql.unsafe(readFileSync(resolve(directory, file), "utf8"));
    }
  }, 180_000);
  afterAll(async () => { await context?.dispose(); }, 30_000);

  it("checks actual schema objects and executes reservation/notification lease queries", async () => {
    await expect(assertBackendSchema(context.sql, context.schema)).resolves.toBeUndefined();
    await context.sql.begin(async (tx) => {
      await expect(new PostgresAssignmentRepository(tx).findActiveByMechanicForUpdate(randomUUID())).resolves.toBeUndefined();
      await expect(new PostgresNotificationDeliveryRepository(tx).claim({
        id: randomUUID(), token: randomUUID(), now: new Date(), leaseUntil: new Date(Date.now() + 60_000)
      })).resolves.toBeUndefined();
    });
    await context.sql.unsafe("alter table notification_delivery_receipts drop column lease_token cascade");
    expect((await checkBackendSchema(context.sql, context.schema)).columns).toBe(false);
    await expect(assertBackendSchema(context.sql, context.schema)).rejects.toThrow("BACKEND_SCHEMA_INCOMPATIBLE");
  });

  it("restores append-only guards after successful and failed test cleanup", async () => {
    const { sql } = context;
    await cleanupPostgresTables(sql, ["app_users", "audit_logs"], { resetAppendOnlyTables: true });
    await expect(sql.unsafe("truncate table audit_logs")).rejects.toThrow("append-only");
    await expect(sql.unsafe("truncate table admin_internal_notes")).rejects.toThrow("append-only");
    await expect(cleanupPostgresTables(sql, ["table_that_does_not_exist"], { resetAppendOnlyTables: true }))
      .rejects.toThrow("does not exist");
    await expect(sql.unsafe("truncate table audit_logs")).rejects.toThrow("append-only");
    await expect(sql.unsafe("truncate table admin_internal_notes")).rejects.toThrow("append-only");
  });
});
