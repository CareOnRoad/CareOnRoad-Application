import { describe, expect, it } from "vitest";

import type { AssignmentLiveLocation } from "../../contracts/live-tracking.repository";
import { InMemoryLiveTrackingRepository } from "../in-memory-live-tracking.repository";

const now = new Date("2026-08-23T07:00:00.000Z");

describe("in-memory live tracking repository contract", () => {
  it("creates then overwrites the only assignment point", async () => {
    const rows: AssignmentLiveLocation[] = [];
    const repository = new InMemoryLiveTrackingRepository(rows);
    const first = await repository.upsert(location("2026-08-23T06:59:55.000Z", 10.77));
    const second = await repository.upsert(location("2026-08-23T07:00:01.000Z", 10.78));

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(rows).toHaveLength(1);
    await expect(repository.findByAssignmentIdForUpdate(assignmentId)).resolves.toMatchObject({
      latitude: 10.78,
      observedAt: new Date("2026-08-23T07:00:01.000Z")
    });
  });

  it("hides expired rows and deletes them in bounded idempotent batches", async () => {
    const rows = [
      location("2026-08-23T06:50:00.000Z", 10.70, "2026-08-23T06:59:00.000Z", assignmentId),
      location("2026-08-23T06:51:00.000Z", 10.71, "2026-08-23T06:59:30.000Z", otherAssignmentId)
    ];
    const repository = new InMemoryLiveTrackingRepository(rows);
    await expect(repository.findCurrentByAssignmentId(assignmentId, now)).resolves.toBeUndefined();
    await expect(repository.deleteExpired(now, 1)).resolves.toBe(1);
    await expect(repository.deleteExpired(now, 1)).resolves.toBe(1);
    await expect(repository.deleteExpired(now, 1)).resolves.toBe(0);
  });
});

const assignmentId = "11111111-1111-4111-8111-111111111111";
const otherAssignmentId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";

function location(
  observedAt: string,
  latitude: number,
  expiresAt = "2026-08-23T07:15:00.000Z",
  targetAssignmentId = assignmentId
): AssignmentLiveLocation {
  return {
    assignmentId: targetAssignmentId,
    mechanicId,
    latitude,
    longitude: 106.7,
    observedAt: new Date(observedAt),
    accuracyMeters: 12,
    receivedAt: now,
    expiresAt: new Date(expiresAt),
    createdAt: now,
    updatedAt: now
  };
}
