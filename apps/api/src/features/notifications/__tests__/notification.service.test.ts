import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { NotificationService } from "../notification.service";

const now = new Date("2026-06-30T03:00:00.000Z");
const userId = "11111111-1111-4111-8111-111111111111";

describe("NotificationService", () => {
  it("creates one deduplicated notification with atomic sanitized audit and outbox", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new NotificationService(unitOfWork, {
      now: () => now,
      createId: sequentialIds(["notification-1", "event-1", "audit-1", "unused"])
    });
    const input = {
      userId,
      type: "reminder_due",
      title: "Đến hạn bảo dưỡng",
      body: "Bạn có một lịch bảo dưỡng đến hạn.",
      data: {
        resource_id: "33333333-3333-4333-8333-333333333333",
        status: "due",
        authorization: "Bearer secret",
        diagnosis_text: "full diagnosis"
      },
      dedupeKey: "reminder-due:occurrence-1",
      actorId: userId,
      actorRole: "rider" as const
    };

    await expect(service.createNotification(input)).resolves.toMatchObject({
      created: true,
      notification: {
        id: "notification-1",
        status: "pending",
        data: { resource_id: "33333333-3333-4333-8333-333333333333", status: "due" }
      }
    });
    await expect(service.createNotification(input)).resolves.toMatchObject({
      created: false,
      notification: { id: "notification-1" }
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.notifications).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.auditLogs).toHaveLength(1);
    expect(snapshot.outboxEvents[0]).toMatchObject({
      topic: "notification.created",
      dedupeKey: "notification.created:reminder-due:occurrence-1"
    });
    const eventPayloads = JSON.stringify({
      outbox: snapshot.outboxEvents,
      audit: snapshot.auditLogs
    });
    expect(eventPayloads).not.toContain("Đến hạn");
    expect(eventPayloads).not.toContain("Bearer secret");
    expect(eventPayloads).not.toContain("full diagnosis");
  });

  it("marks delivery sent or failed with audit and no recursive outbox", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new NotificationService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        "notification-1",
        "event-1",
        "audit-created",
        "audit-sent",
        "audit-failed"
      ])
    });
    const created = await service.createNotification({
      userId,
      type: "dispatch_offer",
      title: "Có yêu cầu mới",
      body: "Mở ứng dụng để xem.",
      dedupeKey: "dispatch-offer:1"
    });

    await expect(service.markSent(created.notification.id)).resolves.toMatchObject({
      status: "sent",
      sentAt: now
    });
    await expect(
      service.markFailed(created.notification.id, "provider timeout: token=private")
    ).resolves.toMatchObject({
      status: "failed",
      lastErrorCode: "DELIVERY_FAILED"
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.auditLogs.map((log) => log.action)).toEqual([
      "notification.created",
      "notification.sent",
      "notification.failed"
    ]);
  });
});

function createUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [{ id: userId, status: "active", createdAt: now, updatedAt: now }]
  });
}

function sequentialIds(ids: string[]): () => string {
  return () => {
    const id = ids.shift();
    if (!id) {
      throw new Error("Test ID sequence exhausted.");
    }
    return id;
  };
}
