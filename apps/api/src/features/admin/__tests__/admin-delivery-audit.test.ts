import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createPushTokenCipher } from "@/features/auth/push-token.crypto";
import { NotificationDeliveryService } from "@/features/notifications/notification-delivery.service";
import { NotificationInboxService } from "@/features/notifications/notification-inbox.service";
import { OutboxWorker } from "@/server/workers/outbox.worker";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { AdminDeliveryService } from "../admin-delivery.service";
import { AdminAuditService } from "../admin-audit.service";
import { createAdminDeliveryRouteHandlers } from "../admin-delivery.route-handlers";
import { createAdminAuditRouteHandlers } from "../admin-audit.route-handlers";

const now = new Date("2026-10-02T00:00:00Z"), earlier = new Date(now.getTime() - 1000);
const admin = randomUUID(), rider = randomUUID(), notificationId = randomUUID(), eventId = randomUUID(), credentialId = randomUUID(), receiptId = randomUUID();
const cipher = createPushTokenCipher(Buffer.alloc(32, 7).toString("base64"));
const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"] });
const reason = { reason: "Checked delivery before recovering the failed receipt" };
function fixture() {
  const encrypted = cipher.encrypt("test-only-device");
  return new InMemoryUnitOfWork({ users: [admin, rider].map((id) => ({ id, status: "active", createdAt: earlier, updatedAt: now })),
    userRoles: [{ userId: admin, role: "admin" }, { userId: rider, role: "rider" }],
    notifications: [{ id: notificationId, userId: rider, type: "test", title: "private title", body: "private body", data: { request_id: randomUUID() }, dedupeKey: "delivery-test", status: "failed", lastErrorCode: "FCM_UNAVAILABLE", readAt: now, createdAt: earlier }],
    outboxEvents: [{ id: eventId, topic: "notification.created", aggregateType: "notification", aggregateId: notificationId, dedupeKey: "notification.created:delivery-test", payload: { resource_id: notificationId }, status: "dead_letter", attemptCount: 5, nextAttemptAt: now, createdAt: earlier }],
    deviceDeliveryCredentials: [{ id: credentialId, userId: rider, deviceId: randomUUID(), provider: "fcm", enabled: true, credentialFingerprint: encrypted.fingerprint,
      credentialCiphertext: encrypted.ciphertext, credentialIv: encrypted.iv, credentialTag: encrypted.authTag, credentialVersion: 1, encryptionKeyVersion: 1, lastRegisteredAt: now, createdAt: earlier, updatedAt: now }],
    notificationDeliveryReceipts: [{ id: receiptId, notificationId, credentialId, credentialVersion: 1, provider: "fcm", status: "permanent_failed", attemptCount: 5, completedAt: now, lastErrorCode: "FCM_UNAVAILABLE", createdAt: earlier, updatedAt: now }],
    auditLogs: [{ id: randomUUID(), actorId: rider, actorRole: "rider", action: "quote.created", entityType: "quote", entityId: randomUUID(), adminReason: "private email=test@example.test",
      metadata: { resource_id: notificationId, field: "private person 0900000000", status: "pending", context: { full_text: "private narrative" } }, createdAt: earlier }]
  });
}
describe("admin delivery and audit operations", () => {
  it("retries only the failed original receipt, replays safely and never resends a sent receipt or newly registered device", async () => {
    const state = fixture().snapshot(); const sentId = randomUUID();
    state.notificationDeliveryReceipts.push({ ...state.notificationDeliveryReceipts[0]!, id: sentId, credentialId: randomUUID(), status: "sent", providerMessageId: "private provider id" });
    state.deviceDeliveryCredentials.push({ ...state.deviceDeliveryCredentials[0]!, id: randomUUID(), deviceId: randomUUID(), credentialFingerprint: "new-device" });
    const uow = new InMemoryUnitOfWork(state); const service = new AdminDeliveryService(uow, { now: () => now });
    const retried = await service.command(identity(admin), "notifications", notificationId, "retry", reason, "retry-notification-key");
    expect(await service.command(identity(admin), "notifications", notificationId, "retry", reason, "retry-notification-key")).toEqual(retried);
    expect(uow.snapshot().notificationDeliveryReceipts.find((row) => row.id === sentId)).toEqual(state.notificationDeliveryReceipts[1]);
    const send = vi.fn(async () => ({ kind: "success" as const }));
    const delivery = new NotificationDeliveryService(uow, { send }, cipher, { now: () => now });
    await new OutboxWorker(uow, { now: () => now, batchSize: 10, consumers: { handlers: { "notification.created": async (event) => ({ notificationStatus: (await delivery.deliver(event.aggregateId)).status }) } } }).processBatch();
    expect(send).toHaveBeenCalledTimes(1); expect(uow.snapshot().notificationDeliveryReceipts).toHaveLength(2);
    expect(uow.snapshot().notifications[0]).toMatchObject({ status: "sent", readAt: now, adminRetryCount: 1 });
    expect(uow.snapshot().outboxEvents.find((row) => row.id === eventId)).toMatchObject({ status: "processed", payload: state.outboxEvents[0]!.payload, dedupeKey: state.outboxEvents[0]!.dedupeKey });
  });

  it("rejects admin retry/cancel while a real worker provider attempt holds its lease", async () => {
    const uow = fixture(); const service = new AdminDeliveryService(uow, { now: () => now });
    await service.command(identity(admin), "notifications", notificationId, "retry", reason, "prepare-provider-race");
    let started!: () => void, release!: () => void;
    const sending = new Promise<void>((resolve) => { started = resolve; }), paused = new Promise<void>((resolve) => { release = resolve; });
    const delivery = new NotificationDeliveryService(uow, { send: async () => { started(); await paused; return { kind: "success" }; } }, cipher, { now: () => now });
    const worker = new OutboxWorker(uow, { now: () => now, batchSize: 1, consumers: { handlers: { "notification.created": async (event) => ({ notificationStatus: (await delivery.deliver(event.aggregateId)).status }) } } }).processBatch();
    await sending; const before = uow.snapshot();
    await expect(service.command(identity(admin), "notifications", notificationId, "cancel", reason, "cancel-provider-race")).rejects.toMatchObject({ status: 409 });
    await expect(service.command(identity(admin), "outbox", eventId, "retry", reason, "retry-provider-race")).rejects.toMatchObject({ status: 409 });
    expect(uow.snapshot()).toEqual(before); release(); await worker;
  });

  it("cancels delivery and abandons its source without deleting or changing the rider inbox read state", async () => {
    const state = fixture().snapshot(); state.notifications[0]!.status = "pending"; state.notifications[0]!.lastErrorCode = undefined; state.notifications[0]!.readAt = undefined;
    state.outboxEvents[0]!.status = "pending"; state.notificationDeliveryReceipts[0]!.status = "pending"; state.notificationDeliveryReceipts[0]!.completedAt = undefined;
    const uow = new InMemoryUnitOfWork(state); const service = new AdminDeliveryService(uow, { now: () => now });
    await service.command(identity(admin), "notifications", notificationId, "cancel", reason, "cancel-pending-key");
    const send = vi.fn(); await expect(new NotificationDeliveryService(uow, { send }, cipher, { now: () => now }).deliver(notificationId)).resolves.toEqual({ status: "canceled" });
    expect(send).not.toHaveBeenCalled(); expect(uow.snapshot().notifications).toHaveLength(1);
    expect(uow.snapshot().notifications[0]).toMatchObject({ status: "canceled", readAt: undefined });
    expect(uow.snapshot().outboxEvents[0]!.status).toBe("abandoned");
    const inbox = new NotificationInboxService(uow, { now: () => now });
    expect(await inbox.list(identity(rider), {})).toMatchObject({ items: [expect.objectContaining({ id: notificationId, status: "canceled" })] });
    await uow.execute(async ({ notifications }) => { expect((await notifications.markSent(notificationId, now)).status).toBe("canceled"); });
  });

  it.each(["invalid", "disabled", "sent", "leased", "limit"])("rejects %s notification recovery atomically", async (blocker) => {
    const state = fixture().snapshot();
    if (blocker === "invalid") state.notificationDeliveryReceipts[0]!.status = "invalid";
    if (blocker === "disabled") state.deviceDeliveryCredentials[0]!.enabled = false;
    if (blocker === "sent") state.notifications[0]!.status = "sent";
    if (blocker === "leased") state.notificationDeliveryReceipts[0]!.leaseExpiresAt = new Date(now.getTime() + 60_000);
    if (blocker === "limit") state.notifications[0]!.adminRetryCount = 3;
    const uow = new InMemoryUnitOfWork(state); const before = uow.snapshot();
    await expect(new AdminDeliveryService(uow, { now: () => now }).command(identity(admin), "notifications", notificationId, "retry", reason, "unsafe-retry-key")).rejects.toMatchObject({ status: 409 });
    expect(uow.snapshot()).toEqual(before);
  });

  it("blocks critical handoff abandonment and replays domain history without duplicating the quote", async () => {
    const state = fixture().snapshot(); const quoteId = randomUUID();
    state.outboxEvents[0] = { ...state.outboxEvents[0]!, topic: "assignment.recovery.requested", aggregateType: "assignment" };
    let uow = new InMemoryUnitOfWork(state); const before = uow.snapshot();
    await expect(new AdminDeliveryService(uow, { now: () => now }).command(identity(admin), "outbox", eventId, "abandon", reason, "critical-abandon-key")).rejects.toMatchObject({ details: { reason_code: "critical_handoff_cannot_abandon" } });
    expect(uow.snapshot()).toEqual(before);
    state.outboxEvents[0]!.topic = "quote.created"; state.outboxEvents[0]!.aggregateId = quoteId; state.outboxEvents[0]!.aggregateType = "quote";
    state.quotes.push({ id: quoteId, requestId: randomUUID(), assignmentId: randomUUID(), version: 1, status: "approved", currency: "VND", subtotalAmount: 100, discountAmount: 0, totalAmount: 100, createdBy: rider, createdAt: earlier, lines: [] });
    uow = new InMemoryUnitOfWork(state); const service = new AdminDeliveryService(uow, { now: () => now });
    await service.command(identity(admin), "outbox", eventId, "retry", reason, "domain-history-retry");
    await new OutboxWorker(uow, { now: () => now, batchSize: 10 }).processBatch();
    expect(uow.snapshot().quotes).toEqual(state.quotes);
    expect(uow.snapshot().outboxEvents[0]).toMatchObject({ status: "processed", payload: state.outboxEvents[0]!.payload });
  });

  it("queries and exports bounded redacted audit while preserving every original row and appending one access record", async () => {
    const uow = fixture(); const source = uow.snapshot().auditLogs; const service = new AdminAuditService(uow, { now: () => now });
    const exported = await service.read(identity(admin), { actor_id: rider, limit: 1 }, "export");
    expect(exported).toMatchObject({ items: [expect.objectContaining({ metadata: { resource_id: notificationId, status: "pending" } })], exported_count: 1 });
    expect(JSON.stringify(exported)).not.toMatch(/private|0900000000|test@example/);
    expect(uow.snapshot().auditLogs.slice(0, source.length)).toEqual(source); expect(uow.snapshot().auditLogs).toHaveLength(source.length + 1);
    expect(uow.snapshot().auditLogs.at(-1)).toMatchObject({ action: "admin.audit.exported", actorId: admin, createdAt: now, metadata: { filter_hash: expect.stringMatching(/^[a-f0-9]{64}$/), exported_count: 1 } });
    await expect(service.read(identity(admin), { from: "2026-01-01T00:00:00Z", to: now.toISOString() }, "export")).rejects.toMatchObject({ status: 400 });
    await expect(service.read(identity(admin), { limit: 10_001 }, "export")).rejects.toMatchObject({ status: 400 });
    await expect(service.read(identity(rider), {}, "export")).rejects.toMatchObject({ status: 403 });
  });

  it("protects operation routes, strict filters and detail redaction", async () => {
    const uow = fixture(); const service = new AdminDeliveryService(uow, { now: () => now });
    const riderRoutes = createAdminDeliveryRouteHandlers({ authenticate: async () => identity(rider), service });
    expect((await riderRoutes.read(new Request("http://localhost/"), "notifications", "list")).status).toBe(403);
    const routes = createAdminDeliveryRouteHandlers({ authenticate: async () => identity(admin), service });
    const detail = await routes.read(new Request("http://localhost/"), "notifications", "detail", notificationId);
    expect(detail.status).toBe(200); expect(JSON.stringify(await detail.json())).not.toMatch(/private|cipher|fingerprint|provider_message|payload|title|body/);
    expect((await routes.read(new Request("http://localhost/?limit=101"), "outbox", "list")).status).toBe(400);
    expect((await routes.command(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ ...reason, status: "sent" }), headers: { "x-idempotency-key": "valid-key" } }), "notifications", notificationId, "retry")).status).toBe(400);
    const audit = createAdminAuditRouteHandlers({ authenticate: async () => identity(admin), service: new AdminAuditService(uow, { now: () => now }) });
    expect((await audit.read(new Request("http://localhost/?actor_id=bad"), "query")).status).toBe(400);
    expect((await audit.read(new Request("http://localhost/?limit=10001"), "export")).status).toBe(400);
  });
});
