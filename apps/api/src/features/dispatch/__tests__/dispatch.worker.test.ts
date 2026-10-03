import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { DispatchWorker } from "@/server/workers/dispatch.worker";

const now = new Date("2026-06-25T05:01:00Z");
const requestId = "11111111-1111-4111-8111-111111111111";
const mechanicA = "22222222-2222-4222-8222-222222222222";
const mechanicB = "33333333-3333-4333-8333-333333333333";

describe("dispatch worker", () => {
  it("expires an offer and opens the next radius without re-offering a mechanic", async () => {
    const unitOfWork = createUnitOfWork();
    const worker = new DispatchWorker(unitOfWork, {
      now: () => now,
      workerId: "worker-a",
      createId: sequentialIds(Array.from({ length: 20 }, (_, index) => uuid(index + 1)))
    });

    await expect(worker.processBatch()).resolves.toEqual({
      claimed: 1,
      advanced: 1,
      escalated: 0,
      skipped: 0,
      failed: 0
    });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.dispatchRounds.map((round) => [round.roundNumber, round.radiusMeters, round.status]))
      .toEqual([
        [1, 2000, "expired"],
        [2, 5000, "active"]
      ]);
    expect(snapshot.dispatchCandidates.map((candidate) => candidate.mechanicId)).toEqual([
      mechanicA,
      mechanicB
    ]);
    expect(snapshot.dispatchCandidates[0]?.status).toBe("expired");
  });

  it("escalates the fourth expired round exactly once", async () => {
    const unitOfWork = createUnitOfWork({ fourRounds: true });
    const worker = new DispatchWorker(unitOfWork, {
      now: () => now,
      workerId: "worker-a",
      createId: sequentialIds(Array.from({ length: 20 }, (_, index) => uuid(index + 30)))
    });

    await expect(worker.processBatch()).resolves.toMatchObject({ claimed: 1, escalated: 1 });
    await expect(worker.processBatch()).resolves.toMatchObject({ claimed: 0, escalated: 0 });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.serviceRequests[0]?.status).toBe("manual_escalation");
    expect(snapshot.requestStatusHistory.filter((item) => item.toStatus === "manual_escalation"))
      .toHaveLength(1);
    expect(snapshot.outboxEvents.filter((item) => item.topic === "dispatch.request.manual_escalated"))
      .toHaveLength(1);
  });

  it("isolates one item failure and prevents two workers from claiming the same rounds", async () => {
    const unitOfWork = createTwoRequestUnitOfWork();
    let calls = 0;
    const first = new DispatchWorker(unitOfWork, {
      now: () => now,
      workerId: "worker-a",
      processRound: async () => {
        calls += 1;
        if (calls === 1) throw new Error("injected");
        return "advanced";
      }
    });
    const second = new DispatchWorker(unitOfWork, {
      now: () => now,
      workerId: "worker-b",
      processRound: async () => "advanced"
    });

    const [firstResult, secondResult] = await Promise.all([
      first.processBatch(),
      second.processBatch()
    ]);

    expect(firstResult).toMatchObject({ claimed: 2, advanced: 1, failed: 1 });
    expect(secondResult.claimed).toBe(0);
    expect(unitOfWork.snapshot().dispatchRounds.filter((round) => round.failureCount === 1))
      .toHaveLength(1);
  });
});

function createUnitOfWork(options: { fourRounds?: boolean } = {}) {
  const rounds = options.fourRounds
    ? [
        dispatchRound(1, "expired"),
        dispatchRound(2, "expired"),
        dispatchRound(3, "expired"),
        dispatchRound(4, "active")
      ]
    : [dispatchRound(1, "active")];
  return new InMemoryUnitOfWork({
    users: [mechanicA, mechanicB].map((id) => ({ id, status: "active", createdAt: now, updatedAt: now })),
    userRoles: [mechanicA, mechanicB].map((userId) => ({ userId, role: "mechanic" })),
    serviceRequests: [serviceRequest(requestId)],
    dispatchRounds: rounds,
    dispatchCandidates: [candidate("offer-a", rounds.at(-1)!.id, requestId, mechanicA)],
    mechanicProfiles: [
      mechanic(mechanicA, 10.762622),
      mechanic(mechanicB, 10.789)
    ]
  });
}

function createTwoRequestUnitOfWork() {
  const requestB = "44444444-4444-4444-8444-444444444444";
  return new InMemoryUnitOfWork({
    serviceRequests: [serviceRequest(requestId), serviceRequest(requestB)],
    dispatchRounds: [dispatchRound(1, "active", requestId), dispatchRound(1, "active", requestB)]
  });
}

function serviceRequest(id: string) {
  return {
    id,
    requestCode: `COR-MOB-${id.slice(0, 4)}`,
    riderId: "55555555-5555-4555-8555-555555555555",
    motorcycleId: "66666666-6666-4666-8666-666666666666",
    serviceType: "mobile_repair" as const,
    problemDescription: "Can ho tro",
    status: "offered" as const,
    priority: "normal" as const,
    serviceLocation: { latitude: 10.762622, longitude: 106.660172 },
    createdAt: new Date(now.getTime() - 240_000),
    updatedAt: now
  };
}

function dispatchRound(
  roundNumber: number,
  status: "active" | "expired",
  ownedRequestId = requestId
) {
  return {
    id: `${ownedRequestId.slice(0, 8)}-0000-4000-8000-${String(roundNumber).padStart(12, "0")}`,
    requestId: ownedRequestId,
    roundNumber,
    radiusMeters: [2000, 5000, 8000, 12000][roundNumber - 1]!,
    status,
    startedAt: new Date(now.getTime() - (5 - roundNumber) * 60_000),
    expiresAt: new Date(now.getTime() - (4 - roundNumber) * 60_000),
    ...(status === "expired" ? { completedAt: new Date(now.getTime() - 30_000) } : {})
  };
}

function candidate(id: string, roundId: string, ownedRequestId: string, mechanicId: string) {
  return {
    id,
    roundId,
    requestId: ownedRequestId,
    mechanicId,
    rank: 1,
    status: "offered" as const,
    offeredAt: new Date(now.getTime() - 60_000),
    expiresAt: now,
    createdAt: new Date(now.getTime() - 60_000)
  };
}

function mechanic(userId: string, latitude: number) {
  return {
    userId,
    profileStatus: "active" as const,
    isAvailable: true,
    serviceRadiusKm: 20,
    latestLocation: { latitude, longitude: 106.660172 },
    locationUpdatedAt: now,
    availabilityUpdatedAt: now,
    ratingAvg: 4,
    ratingCount: 1,
    serviceTypes: ["mobile_repair" as const],
    createdAt: now,
    updatedAt: now
  };
}

function sequentialIds(ids: string[]) {
  return () => {
    const id = ids.shift();
    if (!id) throw new Error("Test ID sequence exhausted.");
    return id;
  };
}

function uuid(index: number) {
  return `99999999-9999-4999-8999-${String(index).padStart(12, "0")}`;
}
