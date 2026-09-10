import { describe, expect, it, vi } from "vitest";

import { createNotificationInboxRouteHandlers } from "../notification-inbox.route-handlers";

const notificationId = "11111111-1111-4111-8111-111111111111";
const identity = { subject: "user-1", issuer: "issuer", audience: ["authenticated"] };

describe("notification inbox routes", () => {
  it("authenticates list/count and forwards bounded query input", async () => {
    const service = createService();
    const handlers = createNotificationInboxRouteHandlers({
      authenticate: async () => identity,
      service
    });
    const list = await handlers.list(
      new Request("http://localhost/api/v1/notifications?limit=10&unread_only=true")
    );
    expect(list.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(identity, {
      limit: "10",
      unread_only: "true"
    });
    const count = await handlers.unreadCount(new Request("http://localhost/api/v1/notifications/unread-count"));
    await expect(count.json()).resolves.toEqual({ unread_count: 2 });
  });

  it("maps mark-one and mark-all and returns controlled auth errors", async () => {
    const service = createService();
    const handlers = createNotificationInboxRouteHandlers({
      authenticate: async (request) => {
        if (!request.headers.has("authorization")) {
          throw Object.assign(new Error("Authentication required."), {
            status: 401,
            errorCode: "UNAUTHORIZED"
          });
        }
        return identity;
      },
      service
    });
    const unauthorized = await handlers.markAllRead(
      new Request("http://localhost/api/v1/notifications/read-all", { method: "POST" })
    );
    expect(unauthorized.status).toBe(401);
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { authorization: "Bearer test" }
    });
    expect((await handlers.markRead(request, notificationId)).status).toBe(200);
    expect((await handlers.markAllRead(request)).status).toBe(200);
    expect(service.markRead).toHaveBeenCalledWith(identity, notificationId);
  });
});

function createService() {
  return {
    list: vi.fn(async () => ({ items: [], page: { limit: 10, has_more: false } })),
    unreadCount: vi.fn(async () => ({ unread_count: 2 })),
    markRead: vi.fn(async () => ({ id: notificationId, read_at: "2026-08-23T00:00:00.000Z" })),
    markAllRead: vi.fn(async () => ({ marked_read: 2, read_at: "2026-08-23T00:00:00.000Z" }))
  };
}
