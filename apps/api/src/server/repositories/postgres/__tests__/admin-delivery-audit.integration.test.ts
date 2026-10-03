import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Sql } from "postgres";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createPushTokenCipher } from "@/features/auth/push-token.crypto";
import { NotificationService } from "@/features/notifications/notification.service";
import { NotificationInboxService } from "@/features/notifications/notification-inbox.service";
import { NotificationDeliveryService } from "@/features/notifications/notification-delivery.service";
import { AdminDeliveryService } from "@/features/admin/admin-delivery.service";
import { AdminAuditService } from "@/features/admin/admin-audit.service";
import { OutboxWorker } from "@/server/workers/outbox.worker";
import { createIsolatedPostgresTestContext, hasPostgresTestDatabase, cleanupPostgresTables, type IsolatedPostgresTestContext } from "@/server/testing/postgres-test-context";
import { PostgresUnitOfWork } from "../postgres-unit-of-work";

const describeDatabase = hasPostgresTestDatabase() ? describe : describe.skip;
const adminId = randomUUID(), riderId = randomUUID(), deviceId = randomUUID(), credentialId = randomUUID();
const now = new Date("2026-10-02T00:00:00Z"), earlier = new Date(now.getTime() - 1000);
const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"] });
const cipher = createPushTokenCipher(Buffer.alloc(32, 9).toString("base64"));
const reason = { reason: "Checked worker and failed delivery before recovery" };
describeDatabase("admin delivery and audit native PostgreSQL operations", () => {
  let context: IsolatedPostgresTestContext, sql: Sql, uow: PostgresUnitOfWork;
  beforeAll(async () => {
    context = await createIsolatedPostgresTestContext(process.env, { maxConnections: 6 }); sql = context.sql;
    const directory = resolve(process.cwd(), "..", "..", "supabase", "migrations");
    for (const name of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) await sql.unsafe(readFileSync(resolve(directory, name), "utf8"));
    for (const id of [adminId, riderId]) await sql`insert into auth.users (id, created_at, updated_at) values (${id}, now(), now())`;
    uow = new PostgresUnitOfWork(sql);
  }, 30_000);
  beforeEach(async () => {
    await cleanupPostgresTables(sql, ["notifications", "user_devices", "app_users", "outbox_events", "audit_logs", "idempotency_records"], { resetAppendOnlyTables: true });
    for (const id of [adminId, riderId]) await sql`insert into app_users (id, status, created_at, updated_at) values (${id}, 'active', ${earlier}, ${now})`;
    await sql`insert into user_roles (user_id, role) values (${adminId}, 'admin'), (${riderId}, 'rider')`;
    await sql`insert into user_devices (id, user_id, device_key_hash, platform) values (${deviceId}, ${riderId}, ${"a".repeat(64)}, 'android')`;
    const encrypted = cipher.encrypt("native-test-device");
    await sql`insert into device_delivery_credentials (id, device_id, user_id, provider, credential_fingerprint, credential_ciphertext, credential_iv, credential_tag, encryption_key_version, credential_version, last_registered_at)
      values (${credentialId}, ${deviceId}, ${riderId}, 'fcm', ${encrypted.fingerprint}, ${encrypted.ciphertext}, ${encrypted.iv}, ${encrypted.authTag}, 1, 1, ${earlier})`;
  }, 30_000);
  afterAll(async () => { await context?.dispose({ authUserIds: [adminId, riderId] }); }, 30_000);

  async function createDelivery(failed = true) {
    const { notification } = await new NotificationService(uow, { now: () => earlier }).createNotification({ userId: riderId, type: "test", title: "private title", body: "private body", dedupeKey: `native-delivery-${randomUUID()}` });
    const receipt = await uow.execute(({ notificationDeliveries }) => notificationDeliveries.createIfAbsent({ id: randomUUID(), notificationId: notification.id, credentialId, credentialVersion: 1, provider: "fcm", createdAt: earlier }));
    const event = await uow.execute(({ outbox }) => outbox.findByDedupeKey(`notification.created:${notification.dedupeKey}`));
    if (failed) {
      await uow.execute(async (r) => { await r.notificationDeliveries.recordOutcome({ id: receipt.id, status: "permanent_failed", attemptedAt: now, errorCode: "FCM_UNAVAILABLE" }); await r.notifications.markFailed(notification.id, "FCM_UNAVAILABLE"); });
      await sql`update outbox_events set status = 'dead_letter', attempt_count = 5 where id = ${event!.id}`;
    }
    return { notificationId: notification.id, receiptId: receipt.id, eventId: event!.id };
  }

  it("serializes admin retries and rejects cancellation during an actual leased provider attempt", async () => {
    const item = await createDelivery(); const service = new AdminDeliveryService(uow, { now: () => now });
    await new NotificationInboxService(uow, { now: () => now }).markRead(identity(riderId), item.notificationId);
    const original = await sql`select payload, dedupe_key, aggregate_id, topic from outbox_events where id = ${item.eventId}`;
    const keys = ["native-retry-one", "native-retry-two"];
    const race = await Promise.allSettled(keys.map((key) => service.command(identity(adminId), "notifications", item.notificationId, "retry", reason, key)));
    expect(race.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    const winner = race[0]!.status === "fulfilled" ? keys[0]! : keys[1]!;
    await service.command(identity(adminId), "notifications", item.notificationId, "retry", reason, winner);
    expect(await sql`select admin_retry_count from notifications where id = ${item.notificationId}`).toEqual([{ admin_retry_count: 1 }]);
    let started!: () => void, release!: () => void, sendCount = 0;
    const sending = new Promise<void>((resolve) => { started = resolve; }), paused = new Promise<void>((resolve) => { release = resolve; });
    const delivery = new NotificationDeliveryService(uow, { send: async () => { sendCount++; started(); await paused; return { kind: "success" }; } }, cipher, { now: () => now });
    const worker = new OutboxWorker(uow, { now: () => now, batchSize: 1, consumers: { handlers: { "notification.created": async (event) => ({ notificationStatus: (await delivery.deliver(event.aggregateId)).status }) } } }).processBatch();
    await sending;
    try {
      await expect(service.command(identity(adminId), "notifications", item.notificationId, "cancel", reason, "native-inflight-cancel")).rejects.toMatchObject({ status: 409 });
      await expect(service.command(identity(adminId), "outbox", item.eventId, "retry", reason, "native-inflight-retry")).rejects.toMatchObject({ status: 409 });
    } finally { release(); }
    await worker; expect(sendCount).toBe(1);
    expect(await sql`select status, read_at from notifications where id = ${item.notificationId}`).toEqual([{ status: "sent", read_at: now }]);
    expect(await sql`select payload, dedupe_key, aggregate_id, topic from outbox_events where id = ${item.eventId}`).toEqual(original);
    await expect(sql`update outbox_events set payload = '{}'::jsonb where id = ${item.eventId}`).rejects.toMatchObject({ code: "55000" });
  }, 30_000);

  it("races cancellation versus worker claim, excludes abandoned work and rejects stale outcome commits", async () => {
    const item = await createDelivery(false); const service = new AdminDeliveryService(uow, { now: () => now });
    const results = await Promise.allSettled([
      service.command(identity(adminId), "notifications", item.notificationId, "cancel", reason, "cancel-claim-race"),
      uow.execute(({ outbox }) => outbox.claim({ now, leaseOwner: "claim-worker", leaseUntil: new Date(now.getTime() + 60_000), limit: 1 }))
    ]);
    const claim = results[1];
    if (claim?.status === "fulfilled" && claim.value.some((row) => row.id === item.eventId)) {
      expect(results[0]?.status).toBe("rejected");
      await uow.execute(({ outbox }) => outbox.markFailed({ id: item.eventId, leaseOwner: "claim-worker", errorCode: "DELIVERY_FAILED", nextAttemptAt: now, deadLetter: true }));
      await service.command(identity(adminId), "notifications", item.notificationId, "cancel", reason, "cancel-after-claim");
    } else expect(results[0]?.status).toBe("fulfilled");
    expect(await sql`select status, read_at from notifications where id = ${item.notificationId}`).toEqual([{ status: "canceled", read_at: null }]);
    expect(await sql`select status, completed_at from notification_delivery_receipts where id = ${item.receiptId}`).toEqual([{ status: "canceled", completed_at: now }]);
    await expect(uow.execute(({ outbox }) => outbox.markProcessed({ id: item.eventId, leaseOwner: "claim-worker", processedAt: now }))).rejects.toThrow("OUTBOX_LEASE_LOST");
    await expect(uow.execute(({ notificationDeliveries }) => notificationDeliveries.recordOutcome({ id: item.receiptId, status: "sent", attemptedAt: now }))).rejects.toThrow("NOTIFICATION_DELIVERY_LEASE_LOST");
    await new NotificationInboxService(uow, { now: () => now }).markRead(identity(riderId), item.notificationId);
    expect(await sql`select status, read_at from notifications where id = ${item.notificationId}`).toEqual([{ status: "canceled", read_at: now }]);
    const claimed = await uow.execute(({ outbox }) => outbox.claim({ now, leaseOwner: "next-worker", leaseUntil: new Date(now.getTime() + 60_000), limit: 20 }));
    expect(claimed.some((row) => row.id === item.eventId)).toBe(false);
  }, 30_000);

  it("blocks critical handoff abandonment and preserves identity through history retry and terminal abandon", async () => {
    const eventId = randomUUID(), aggregateId = randomUUID();
    await uow.execute(({ outbox }) => outbox.append({ id: eventId, topic: "assignment.recovery.requested", aggregateType: "assignment", aggregateId, dedupeKey: `recovery-${eventId}`, payload: { assignment_id: aggregateId }, status: "dead_letter", nextAttemptAt: now, createdAt: earlier }));
    const service = new AdminDeliveryService(uow, { now: () => now });
    await expect(service.command(identity(adminId), "outbox", eventId, "abandon", reason, "critical-native-abandon")).rejects.toMatchObject({ details: { reason_code: "critical_handoff_cannot_abandon" } });
    const historyId = randomUUID();
    await uow.execute(({ outbox }) => outbox.append({ id: historyId, topic: "quote.created", aggregateType: "quote", aggregateId, dedupeKey: `history-${historyId}`, payload: { resource_id: aggregateId }, status: "dead_letter", attemptCount: 5, nextAttemptAt: now, createdAt: earlier }));
    const original = await sql`select payload, dedupe_key from outbox_events where id = ${historyId}`;
    await service.command(identity(adminId), "outbox", historyId, "retry", reason, "history-native-retry");
    expect(await sql`select attempt_count, admin_retry_count from outbox_events where id = ${historyId}`).toEqual([{ attempt_count: 0, admin_retry_count: 1 }]);
    await service.command(identity(adminId), "outbox", historyId, "abandon", reason, "history-native-abandon");
    expect(await sql`select payload, dedupe_key from outbox_events where id = ${historyId}`).toEqual(original);
    await expect(sql`update outbox_events set status = 'pending', abandoned_at = null where id = ${historyId}`).rejects.toBeDefined();
  }, 30_000);

  it("exports native safe pages with one access audit and leaves every source row immutable", async () => {
    for (let i = 0; i < 4; i++) await uow.execute(({ audit }) => audit.append({ id: randomUUID(), actorId: riderId, actorRole: "rider", action: "quote.created", entityType: "quote", entityId: randomUUID(),
      adminReason: "private person email=test@example.test", metadata: { field: "private person 0900000000", status: "pending" }, createdAt: earlier }));
    const source = await sql`select * from audit_logs order by id`;
    const service = new AdminAuditService(uow, { now: () => now });
    const first = await service.read(identity(adminId), { actor_id: riderId, limit: 2 });
    expect(first).toMatchObject({ items: [expect.any(Object), expect.any(Object)], page: { has_more: true } });
    const cursor = (first as { page: { next_cursor: string } }).page.next_cursor;
    const second = await service.read(identity(adminId), { actor_id: riderId, cursor, limit: 2 });
    expect(second).toMatchObject({ items: [expect.any(Object), expect.any(Object)], page: { has_more: false } });
    const exported = await service.read(identity(adminId), { actor_id: riderId, limit: 2 }, "export");
    expect(exported).toMatchObject({ exported_count: 2, has_more: true }); expect(JSON.stringify(exported)).not.toContain("private");
    expect(await sql`select * from audit_logs where action <> 'admin.audit.exported' order by id`).toEqual(source);
    const access = await sql<{ metadata: Record<string, unknown> }[]>`select metadata from audit_logs where action = 'admin.audit.exported'`;
    expect(access).toHaveLength(1); expect(access[0]!.metadata).toEqual({ filter_hash: expect.stringMatching(/^[a-f0-9]{64}$/), exported_count: 2 });
    await expect(sql`delete from audit_logs where action = 'quote.created'`).rejects.toMatchObject({ code: "55000" });
  }, 30_000);
});
