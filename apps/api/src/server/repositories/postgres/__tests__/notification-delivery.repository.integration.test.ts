import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

describeDatabase("notification delivery repository integration", () => {
  let context: IsolatedPostgresTestContext;
  let sql: Sql;
  let userId: string;
  let deviceId: string;
  let credentialId: string;
  let notificationId: string;
  const now = new Date("2026-08-23T04:00:00.000Z");

  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 4 });
    sql = context.sql;
    for (const migrationFile of migrationFiles) {
      await sql.unsafe(
        readFileSync(resolve(process.cwd(), "..", "..", "supabase", "migrations", migrationFile), "utf8")
      );
    }
    userId = randomUUID();
    deviceId = randomUUID();
    credentialId = randomUUID();
    notificationId = randomUUID();
    await sql`insert into auth.users (id, created_at, updated_at) values (${userId}, now(), now())`;
    await sql`insert into app_users (id, status) values (${userId}, 'active')`;
    await sql`
      insert into user_devices (id, user_id, device_key_hash, platform)
      values (${deviceId}, ${userId}, ${"a".repeat(64)}, 'android')
    `;
    await sql`
      insert into device_delivery_credentials (
        id, device_id, user_id, provider, credential_fingerprint,
        credential_ciphertext, credential_iv, credential_tag,
        encryption_key_version, credential_version, last_registered_at
      ) values (
        ${credentialId}, ${deviceId}, ${userId}, 'fcm', ${"b".repeat(64)},
        'encrypted-only', 'iv-only', 'tag-only', 1, 1, ${now}
      )
    `;
    await sql`
      insert into notifications (id, user_id, type, title, body, data, dedupe_key)
      values (${notificationId}, ${userId}, 'test', 'Title', 'Body', '{}'::jsonb, 'delivery-integration')
    `;
  }, 120_000);

  afterAll(async () => {
    await context?.dispose({ authUserIds: userId ? [userId] : [] });
  }, 30_000);

  it("deduplicates credential versions and persists sanitized state transitions", async () => {
    const unitOfWork = new PostgresUnitOfWork(sql);
    const firstId = randomUUID();
    const first = await unitOfWork.execute(({ notificationDeliveries }) =>
      notificationDeliveries.createIfAbsent({
        id: firstId,
        notificationId,
        credentialId,
        credentialVersion: 1,
        provider: "fcm",
        createdAt: now
      })
    );
    const replay = await unitOfWork.execute(({ notificationDeliveries }) =>
      notificationDeliveries.createIfAbsent({
        id: randomUUID(),
        notificationId,
        credentialId,
        credentialVersion: 1,
        provider: "fcm",
        createdAt: now
      })
    );
    expect(replay.id).toBe(first.id);

    await unitOfWork.execute(({ notificationDeliveries }) =>
      notificationDeliveries.recordOutcome({
        id: first.id,
        status: "retryable_failed",
        attemptedAt: now,
        errorCode: "FCM_UNAVAILABLE"
      })
    );
    const completedAt = new Date(now.getTime() + 1_000);
    await unitOfWork.execute(({ notificationDeliveries }) =>
      notificationDeliveries.recordOutcome({
        id: first.id,
        status: "sent",
        attemptedAt: completedAt,
        providerMessageId: "projects/test/messages/safe-id"
      })
    );

    const receipts = await unitOfWork.execute(({ notificationDeliveries }) =>
      notificationDeliveries.listByNotificationId(notificationId)
    );
    expect(receipts).toMatchObject([
      { id: first.id, status: "sent", attemptCount: 2, completedAt }
    ]);
    const stored = await sql`select * from notification_delivery_receipts where id = ${first.id}`;
    expect(JSON.stringify(stored)).not.toMatch(/encrypted-only|iv-only|tag-only/);
  }, 30_000);
});
