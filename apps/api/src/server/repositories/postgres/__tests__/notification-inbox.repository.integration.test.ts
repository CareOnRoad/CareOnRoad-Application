import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NotificationInboxService } from "@/features/notifications/notification-inbox.service";
import {
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  type IsolatedPostgresTestContext
} from "@/server/testing/postgres-test-context";

import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const migrationFiles = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

describeDatabase("notification inbox repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let ownerId: string;
  let otherId: string;
  let firstId: string;
  const now = new Date("2026-08-23T06:00:00.000Z");

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 4 });
    sql = context.sql;
    for (const migrationFile of migrationFiles) {
      await sql.unsafe(
        readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
      );
    }
    ownerId = randomUUID();
    otherId = randomUUID();
    firstId = randomUUID();
    for (const id of [ownerId, otherId]) {
      await sql`insert into auth.users (id, created_at, updated_at) values (${id}, now(), now())`;
      await sql`insert into app_users (id, status) values (${id}, 'active')`;
      await sql`insert into user_roles (user_id, role) values (${id}, 'rider')`;
    }
    await sql`
      insert into notifications (
        id, user_id, type, title, body, data, dedupe_key, status, sent_at, created_at
      ) values (
        ${firstId}, ${ownerId}, 'test', 'Owner title', 'Owner body',
        '{"resource_id":"safe"}'::jsonb, 'inbox-owner-1', 'sent', ${now},
        ${new Date(now.getTime() - 2_000)}
      ), (
        ${randomUUID()}, ${ownerId}, 'test', 'Second', 'Second body', '{}',
        'inbox-owner-2', 'pending', null, ${new Date(now.getTime() - 1_000)}
      ), (
        ${randomUUID()}, ${otherId}, 'test', 'Foreign', 'Foreign body', '{}',
        'inbox-foreign', 'pending', null, ${new Date(now.getTime() - 1_000)}
      )
    `;
  }, 120_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: [ownerId, otherId].filter(Boolean) });
  }, 30_000);

  it("enforces owner pagination and idempotent read mutations without delivery changes", async () => {
    let sequence = 0;
    const service = new NotificationInboxService(new PostgresUnitOfWork(sql), {
      now: () => now,
      createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`
    });
    const identity = { subject: ownerId, issuer: "issuer", audience: ["authenticated"] };
    const list = await service.list(identity, { limit: "10", unread_only: "false" });
    expect(list.items).toHaveLength(2);
    expect(JSON.stringify(list)).not.toContain("Foreign");

    const first = await service.markRead(identity, firstId);
    const replay = await service.markRead(identity, firstId);
    expect(replay.read_at).toBe(first.read_at);
    expect(replay.status).toBe("sent");
    await expect(service.markAllRead(identity)).resolves.toMatchObject({ marked_read: 1 });

    const [rows, auditRows, outboxRows] = await Promise.all([
      sql`select status, sent_at, read_at from notifications where id = ${firstId}`,
      sql`select action, metadata from audit_logs where actor_id = ${ownerId} order by created_at, id`,
      sql`select * from outbox_events where aggregate_id = ${firstId}`
    ]);
    expect(rows[0]).toMatchObject({ status: "sent", sent_at: now, read_at: now });
    expect(auditRows.map((row) => row.action)).toEqual([
      "notification.read",
      "notification.read_all"
    ]);
    expect(JSON.stringify(auditRows)).not.toMatch(/Owner title|Owner body/);
    expect(outboxRows).toHaveLength(0);
  }, 30_000);
});
