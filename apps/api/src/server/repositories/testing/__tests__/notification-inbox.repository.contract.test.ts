import { describe, expect, it } from "vitest";

import type { Notification } from "../../contracts/notification.repository";
import { InMemoryNotificationRepository } from "../in-memory-notification.repository";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-08-23T05:00:00.000Z");

describe("notification inbox repository contract", () => {
  it("paginates owner rows deterministically and filters unread", async () => {
    const repository = new InMemoryNotificationRepository([
      notification("00000000-0000-4000-8000-000000000003", ownerId, 3),
      notification("00000000-0000-4000-8000-000000000002", ownerId, 2),
      { ...notification("00000000-0000-4000-8000-000000000001", ownerId, 1), readAt: now },
      notification("00000000-0000-4000-8000-000000000099", otherId, 4)
    ]);
    const first = await repository.listOwned({ userId: ownerId, unreadOnly: true, limit: 1 });
    expect(first.items.map((item) => item.id)).toEqual([
      "00000000-0000-4000-8000-000000000003"
    ]);
    const second = await repository.listOwned({
      userId: ownerId,
      unreadOnly: true,
      limit: 1,
      cursor: first.nextCursor
    });
    expect(second.items.map((item) => item.id)).toEqual([
      "00000000-0000-4000-8000-000000000002"
    ]);
    await expect(repository.countUnread(ownerId)).resolves.toBe(2);
  });

  it("preserves delivery state and first read timestamp for owner-only mutations", async () => {
    const item = { ...notification("00000000-0000-4000-8000-000000000001", ownerId, 1), status: "sent" as const, sentAt: now };
    const repository = new InMemoryNotificationRepository([item]);
    const firstRead = new Date(now.getTime() + 1_000);
    const replayRead = new Date(now.getTime() + 2_000);
    await expect(repository.markReadOwned({ id: item.id, userId: otherId, readAt: firstRead })).resolves.toBeUndefined();
    await expect(
      repository.markReadOwned({ id: item.id, userId: ownerId, readAt: firstRead })
    ).resolves.toMatchObject({ changed: true });
    await expect(
      repository.markReadOwned({ id: item.id, userId: ownerId, readAt: replayRead })
    ).resolves.toMatchObject({ changed: false });
    expect(item).toMatchObject({ status: "sent", sentAt: now, readAt: firstRead });
    await expect(
      repository.markAllReadOwned({ userId: ownerId, cutoff: now, readAt: replayRead })
    ).resolves.toBe(0);
  });
});

function notification(id: string, userId: string, seconds: number): Notification {
  return {
    id,
    userId,
    type: "test",
    title: "Title",
    body: "Body",
    data: {},
    dedupeKey: `dedupe-${id}`,
    status: "pending",
    createdAt: new Date(now.getTime() + seconds * 1_000)
  };
}
