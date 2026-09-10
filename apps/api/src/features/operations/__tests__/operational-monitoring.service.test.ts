import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { OperationalMonitoringService } from "../operational-monitoring.service";

const adminId = "00000000-0000-4000-8000-000000000001";
const riderId = "00000000-0000-4000-8000-000000000002";
const identity = (subject: string) => ({ subject, issuer: "test", audience: ["authenticated"] });
const user = (id: string) => ({ id, status: "active" as const, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z") });

describe("OperationalMonitoringService", () => {
  it("allows admin pagination and never exposes outbox payload", async () => {
    const unit = new InMemoryUnitOfWork({
      users: [user(adminId)], userRoles: [{ userId: adminId, role: "admin" }],
      outboxEvents: Array.from({ length: 2 }, (_, index) => ({
        id: `00000000-0000-4000-8000-00000000001${index}`,
        topic: "notification.created", aggregateType: "notification", aggregateId: `n-${index}`,
        dedupeKey: `dead-letter-${index}`,
        payload: { secret: "must-not-leak" }, status: "dead_letter" as const,
        attemptCount: 5, availableAt: new Date("2026-01-01T00:00:00Z"),
        nextAttemptAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date(`2026-01-0${index + 1}T00:00:00Z`), updatedAt: new Date("2026-01-01T00:00:00Z")
      }))
    });
    const service = new OperationalMonitoringService(unit);
    const first = await service.list(identity(adminId), "outbox-dead-letters", "http://test?limit=1");
    expect(first.items).toHaveLength(1);
    expect(JSON.stringify(first)).not.toContain("must-not-leak");
    expect(first.page.next_cursor).toBeTruthy();
    const second = await service.list(identity(adminId), "outbox-dead-letters", `http://test?limit=1&cursor=${first.page.next_cursor}`);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
  });

  it("rejects non-admin and malformed cursors", async () => {
    const unit = new InMemoryUnitOfWork({ users: [user(adminId), user(riderId)], userRoles: [{ userId: adminId, role: "admin" }, { userId: riderId, role: "rider" }] });
    const service = new OperationalMonitoringService(unit);
    await expect(service.list(identity(riderId), "worker-runs", "http://test")).rejects.toMatchObject({ status: 403 });
    await expect(service.list(identity(adminId), "worker-runs", "http://test?cursor=bad")).rejects.toMatchObject({ status: 400 });
  });
});
