import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { DispatchService } from "../dispatch.service";

const now = new Date("2026-08-23T03:05:00.000Z");
const requestId = "11111111-1111-4111-8111-111111111111";
const oldMechanicId = "22222222-2222-4222-8222-222222222222";
const nextMechanicId = "33333333-3333-4333-8333-333333333333";

describe("recovered request dispatch", () => {
  it("starts one next round and treats replay as already started", async () => {
    const unitOfWork = new InMemoryUnitOfWork({
      serviceRequests: [{
        id: requestId,
        requestCode: "COR-MOB-20260823-1",
        riderId: "44444444-4444-4444-8444-444444444444",
        motorcycleId: "55555555-5555-4555-8555-555555555555",
        serviceType: "mobile_repair",
        problemDescription: "private",
        status: "submitted",
        priority: "normal",
        serviceLocation: { latitude: 10.76, longitude: 106.66 },
        createdAt: new Date(now.getTime() - 60_000),
        updatedAt: now
      }],
      mechanicProfiles: [profile(oldMechanicId), profile(nextMechanicId)],
      dispatchRounds: [{
        id: "66666666-6666-4666-8666-666666666666",
        requestId,
        roundNumber: 1,
        radiusMeters: 2000,
        status: "accepted",
        startedAt: new Date(now.getTime() - 30_000),
        expiresAt: new Date(now.getTime() - 1),
        completedAt: new Date(now.getTime() - 10_000)
      }],
      dispatchCandidates: [{
        id: "77777777-7777-4777-8777-777777777777",
        roundId: "66666666-6666-4666-8666-666666666666",
        requestId,
        mechanicId: oldMechanicId,
        rank: 1,
        status: "accepted",
        offeredAt: new Date(now.getTime() - 30_000),
        expiresAt: new Date(now.getTime() - 1),
        respondedAt: new Date(now.getTime() - 20_000),
        createdAt: new Date(now.getTime() - 30_000)
      }]
    });
    const ids = [
      "88888888-8888-4888-8888-888888888888",
      "99999999-9999-4999-8999-999999999999",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    ];
    const service = new DispatchService(unitOfWork, { now: () => now, createId: () => ids.shift()! });

    await expect(service.restartRecoveredRequest(requestId)).resolves.toBe("started");
    await expect(service.restartRecoveredRequest(requestId)).resolves.toBe("already_started");
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.dispatchRounds.filter((round) => round.status === "active")).toHaveLength(1);
    expect(snapshot.dispatchRounds.at(-1)?.roundNumber).toBe(2);
    expect(snapshot.dispatchCandidates.at(-1)?.mechanicId).toBe(nextMechanicId);
  });
});

function profile(userId: string) {
  return {
    userId,
    profileStatus: "active" as const,
    isAvailable: true,
    serviceRadiusKm: 20,
    latestLocation: { latitude: 10.7601, longitude: 106.6601 },
    locationUpdatedAt: now,
    availabilityUpdatedAt: now,
    ratingAvg: 4,
    ratingCount: 5,
    serviceTypes: ["mobile_repair" as const],
    createdAt: now,
    updatedAt: now
  };
}
