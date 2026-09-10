import { describe, expect, it } from "vitest";

import type { Notification } from "@/server/repositories/contracts/notification.repository";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { NotificationInboxService } from "../notification-inbox.service";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-08-23T06:00:00.000Z");

describe("NotificationInboxService", () => {
  it("lists only owner notifications with unread cursor pagination and sanitized responses", async () => {
    const unitOfWork = createUnitOfWork([
      notification("00000000-0000-4000-8000-000000000003", ownerId, 3, { resource_id: "safe", authorization: "private" }),
      notification("00000000-0000-4000-8000-000000000002", ownerId, 2),
      { ...notification("00000000-0000-4000-8000-000000000001", ownerId, 1), readAt: now },
      notification("00000000-0000-4000-8000-000000000099", otherId, 4)
    ]);
    const service = new NotificationInboxService(unitOfWork);
    const first = await service.list(identity(ownerId), { unread_only: "true", limit: "1" });
    expect(first.items).toHaveLength(1);
    expect(first.page.has_more).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/authorization|private|dedupe/i);
    const second = await service.list(identity(ownerId), {
      unread_only: "true",
      limit: "1",
      cursor: first.page.next_cursor
    });
    expect(second.items[0]?.id).toBe("00000000-0000-4000-8000-000000000002");
    await expect(service.unreadCount(identity(ownerId))).resolves.toEqual({ unread_count: 2 });
  });

  it("marks one owned item read idempotently without changing delivery status", async () => {
    const item = {
      ...notification("00000000-0000-4000-8000-000000000001", ownerId, -1),
      status: "failed" as const,
      lastErrorCode: "FCM_UNAVAILABLE"
    };
    const unitOfWork = createUnitOfWork([item]);
    let clock = now;
    const service = new NotificationInboxService(unitOfWork, {
      now: () => clock,
      createId: () => `audit-${clock.getTime()}`
    });
    const first = await service.markRead(identity(ownerId), item.id);
    clock = new Date(now.getTime() + 10_000);
    const replay = await service.markRead(identity(ownerId), item.id);
    expect(replay.read_at).toBe(first.read_at);
    expect(replay.status).toBe("failed");
    await expect(service.markRead(identity(otherId), item.id)).rejects.toMatchObject({ status: 404 });
    expect(unitOfWork.snapshot().outboxEvents).toHaveLength(0);
    expect(JSON.stringify(unitOfWork.snapshot().auditLogs)).not.toMatch(/FCM_UNAVAILABLE|Title|Body/);
  });

  it("marks only current owner unread rows and is replay safe", async () => {
    const unitOfWork = createUnitOfWork([
      notification("00000000-0000-4000-8000-000000000001", ownerId, -1),
      notification("00000000-0000-4000-8000-000000000002", ownerId, 1),
      notification("00000000-0000-4000-8000-000000000003", otherId, -1)
    ]);
    const service = new NotificationInboxService(unitOfWork, {
      now: () => now,
      createId: () => "audit-read-all"
    });
    await expect(service.markAllRead(identity(ownerId))).resolves.toMatchObject({ marked_read: 1 });
    await expect(service.markAllRead(identity(ownerId))).resolves.toMatchObject({ marked_read: 0 });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.notifications.find((item) => item.id.endsWith("0002"))?.readAt).toBeUndefined();
    expect(snapshot.notifications.find((item) => item.userId === otherId)?.readAt).toBeUndefined();
    expect(snapshot.outboxEvents).toHaveLength(0);
  });
});

function createUnitOfWork(notifications: Notification[]) {
  return new InMemoryUnitOfWork({
    users: [
      { id: ownerId, status: "active", createdAt: now, updatedAt: now },
      { id: otherId, status: "active", createdAt: now, updatedAt: now }
    ],
    userRoles: [
      { userId: ownerId, role: "rider" },
      { userId: otherId, role: "admin" }
    ],
    notifications
  });
}

function notification(
  id: string,
  userId: string,
  seconds: number,
  data: Record<string, unknown> = {}
): Notification {
  return {
    id,
    userId,
    type: "test",
    title: "Title",
    body: "Body",
    data,
    dedupeKey: `dedupe-${id}`,
    status: "pending",
    createdAt: new Date(now.getTime() + seconds * 1_000)
  };
}

function identity(subject: string) {
  return { subject, issuer: "issuer", audience: ["authenticated"] };
}
