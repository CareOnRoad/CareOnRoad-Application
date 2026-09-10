import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NotificationService } from "@/features/notifications/notification.service";
import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";
import { OutboxWorker } from "@/server/workers/outbox.worker";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = legacyCompatibleMigrationFiles();

describeDatabase("outbox and audit integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let userId: string;
  const now = new Date("2026-06-30T03:00:00.000Z");

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 4 });
    sql = context.sql;
    await applyMigrations(sql);
    userId = randomUUID();
    await sql`insert into auth.users (id, created_at, updated_at) values (${userId}, now(), now())`;
    await sql`
      insert into app_users (id, status, created_at, updated_at)
      values (${userId}, 'active', ${now}, ${now})
    `;
  }, 30_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: userId ? [userId] : [] });
  }, 30_000);

  it("commits notification, sanitized outbox, and audit atomically with stable dedupe", async () => {
    const service = new NotificationService(new PostgresUnitOfWork(sql), {
      now: () => now
    });
    const input = {
      userId,
      type: "reminder_due",
      title: "Private title",
      body: "Private notification body",
      data: {
        resource_id: randomUUID(),
        status: "due",
        authorization: "Bearer private",
        diagnosis_text: "private diagnosis"
      },
      dedupeKey: "integration:notification:1"
    };
    const first = await service.createNotification(input);
    const replay = await service.createNotification(input);
    expect(first.created).toBe(true);
    expect(replay).toMatchObject({
      created: false,
      notification: { id: first.notification.id }
    });

    const [notificationRows, outboxRows, auditRows] = await Promise.all([
      sql`select * from notifications where id = ${first.notification.id}`,
      sql`select * from outbox_events where aggregate_id = ${first.notification.id}`,
      sql`select * from audit_logs where entity_id = ${first.notification.id}`
    ]);
    expect(notificationRows).toHaveLength(1);
    expect(outboxRows).toHaveLength(1);
    expect(auditRows).toHaveLength(1);
    expect(JSON.stringify({ outboxRows, auditRows })).not.toContain("Private");
    expect(JSON.stringify(notificationRows[0]?.data)).not.toContain("private");
  }, 30_000);

  it("rolls back notification, outbox, and audit residue together", async () => {
    const dedupeKey = "integration:rollback";
    await expect(
      new PostgresUnitOfWork(sql).execute(async ({ audit, notifications, outbox }) => {
        const notificationId = randomUUID();
        await notifications.createIfAbsent({
          id: notificationId,
          userId,
          type: "test",
          title: "Test",
          body: "Test",
          data: {},
          dedupeKey,
          createdAt: now
        });
        await outbox.append({
          id: randomUUID(),
          topic: "notification.created",
          aggregateType: "notification",
          aggregateId: notificationId,
          dedupeKey: `notification.created:${dedupeKey}`,
          payload: { resource_id: notificationId },
          createdAt: now
        });
        await audit.append({
          id: randomUUID(),
          action: "notification.created",
          entityType: "notification",
          entityId: notificationId,
          metadata: { resource_id: notificationId },
          createdAt: now
        });
        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");
    await expect(
      sql`
        select
          (select count(*)::int from notifications where dedupe_key = ${dedupeKey}) as notifications,
          (select count(*)::int from outbox_events where dedupe_key = ${`notification.created:${dedupeKey}`}) as outbox
      `
    ).resolves.toEqual([{ notifications: 0, outbox: 0 }]);
  }, 30_000);

  it("records notification delivery status and audit without recursive outbox", async () => {
    const service = new NotificationService(new PostgresUnitOfWork(sql), {
      now: () => now
    });
    const created = await service.createNotification({
      userId,
      type: "dispatch_offer",
      title: "Offer",
      body: "Open app",
      dedupeKey: "integration:delivery"
    });
    const before = await sql`select count(*)::int as count from outbox_events`;
    const result = await new OutboxWorker(new PostgresUnitOfWork(sql), {
      now: () => now,
      workerId: "integration-worker",
      batchSize: 50,
      consumers: { handlers: { "notification.created": async () => undefined } }
    }).processBatch();
    expect(result.processed).toBeGreaterThanOrEqual(1);
    const [notificationRows, outboxCount, auditRows] = await Promise.all([
      sql`select status, sent_at from notifications where id = ${created.notification.id}`,
      sql`select count(*)::int as count from outbox_events`,
      sql`select action from audit_logs where entity_id = ${created.notification.id} order by created_at`
    ]);
    expect(notificationRows[0]).toMatchObject({ status: "sent" });
    expect(outboxCount).toEqual(before);
    expect(auditRows.map((row) => row.action)).toEqual([
      "notification.created",
      "notification.sent"
    ]);
  }, 30_000);

  it("recovers expired leases and enforces append-only sanitized audit/outbox storage", async () => {
    const eventId = randomUUID();
    await sql`
      insert into outbox_events (
        id, topic, aggregate_type, aggregate_id, dedupe_key, payload, status,
        attempt_count, next_attempt_at, lease_owner, lease_expires_at, created_at
      ) values (
        ${eventId}, 'test.event', 'test', ${randomUUID()},
        ${`lease-recovery:${eventId}`}, '{}'::jsonb, 'processing', 1, ${now},
        'crashed-worker', ${new Date(now.getTime() - 1)}, ${now}
      )
    `;
    await expect(
      new OutboxWorker(new PostgresUnitOfWork(sql), {
        now: () => now,
        workerId: "recovery-worker"
      }).processBatch()
    ).resolves.toMatchObject({ claimed: 1, processed: 1 });
    await expect(
      sql`select status, attempt_count from outbox_events where id = ${eventId}`
    ).resolves.toEqual([{ status: "processed", attempt_count: 2 }]);

    const auditId = randomUUID();
    await sql`
      insert into audit_logs (id, action, entity_type, metadata)
      values (${auditId}, 'test.created', 'test', '{"status":"created"}'::jsonb)
    `;
    await expect(
      sql`update audit_logs set action = 'mutated' where id = ${auditId}`
    ).rejects.toBeDefined();
    await expect(sql`delete from audit_logs where id = ${auditId}`).rejects.toBeDefined();
    await expect(sql`truncate table audit_logs`).rejects.toBeDefined();
    await expect(
      sql`
        insert into outbox_events (
          id, topic, aggregate_type, aggregate_id, dedupe_key, payload
        ) values (
          ${randomUUID()}, 'unsafe', 'test', ${randomUUID()}, ${`unsafe:${randomUUID()}`},
          '{"authorization":"Bearer private"}'::jsonb
        )
      `
    ).rejects.toBeDefined();
    await expect(
      sql`
        insert into audit_logs (id, action, entity_type, metadata)
        values (
          ${randomUUID()}, 'unsafe', 'test',
          '{"diagnosis_text":"private diagnosis"}'::jsonb
        )
      `
    ).rejects.toBeDefined();
  }, 30_000);
}, 30_000);

async function applyMigrations(sql: Pick<Sql, "unsafe">): Promise<void> {
  for (const migrationFile of migrationFiles) {
    await sql.unsafe(
      readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
    );
  }
}

function legacyCompatibleMigrationFiles(): string[] {
  return readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
    .filter(
      (name) => name.endsWith(".sql") && name.localeCompare("202606250014") < 0
    )
    .sort();
}
