import { describe, expect, it, vi } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { UnitOfWork } from "@/server/repositories/contracts/unit-of-work";
import type { Assignment, AssignmentStatus } from "@/server/repositories/contracts/assignment.repository";
import { InMemoryDispatchRepository } from "@/server/repositories/testing/in-memory-dispatch.repository";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import {
  DISPATCH_OFFER_EXPIRY_SECONDS,
  DISPATCH_RADIUS_STEPS_KM,
  DISPATCH_TOTAL_WAIT_SECONDS
} from "../dispatch-ranking";
import { DispatchService } from "../dispatch.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const motorcycleId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-06-25T05:00:00Z");

describe("dispatch service", () => {
  it.each(["rounds", "total_wait"])("commits %s escalation before 409 and never duplicates retry events", async (limit) => {
    const state = createUnitOfWork().snapshot();
    state.serviceRequests[0]!.status = "offered";
    state.dispatchRounds = Array.from({ length: limit === "rounds" ? 4 : 1 }, (_, index) => ({
      id: uuid(index + 100), requestId, roundNumber: index + 1, radiusMeters: 2000,
      status: index === (limit === "rounds" ? 3 : 0) ? "active" as const : "expired" as const,
      startedAt: new Date(now.getTime() - (limit === "total_wait" ? 360000 : (4 - index) * 60000)), expiresAt: now
    }));
    const unit = new InMemoryUnitOfWork(state);
    const service = new DispatchService(unit, { now: () => now });
    await expect(service.startDispatch(identity(riderId), requestId)).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    const committed = unit.snapshot();
    expect(committed.serviceRequests[0]?.status).toBe("manual_escalation");
    expect(committed.dispatchRounds.every((round) => round.status === "expired")).toBe(true);
    expect(committed.requestStatusHistory.filter((row) => row.toStatus === "manual_escalation")).toHaveLength(1);
    expect(committed.outboxEvents.filter((event) => event.topic === "dispatch.request.manual_escalated")).toHaveLength(1);
    expect(committed.auditLogs.filter((row) => row.action === "dispatch.request.manual_escalated")).toHaveLength(1);
    await expect(service.startDispatch(identity(riderId), requestId)).rejects.toMatchObject({ status: 409 });
    expect(unit.snapshot()).toEqual(committed);
  });

  it("commits expired decline before 409 and makes subsequent decline read-only", async () => {
    const unit = createUnitOfWork();
    let current = now;
    const service = new DispatchService(unit, { now: () => current });
    const round = await service.startDispatch(identity(riderId), requestId);
    const offer = round.candidates[0]!;
    current = new Date(round.expires_at);
    await expect(service.declineOffer(identity(offer.mechanic_id), offer.id)).rejects.toMatchObject({ status: 409 });
    const committed = unit.snapshot();
    expect(committed.dispatchCandidates.find((item) => item.id === offer.id)?.status).toBe("expired");
    expect(committed.outboxEvents.filter((event) => event.topic === "dispatch.candidate.expired")).toHaveLength(1);
    await expect(service.declineOffer(identity(offer.mechanic_id), offer.id)).rejects.toMatchObject({ status: 409 });
    expect(unit.snapshot()).toEqual(committed);
  });

  it("expires a round once, rejects early expiry, and opens the next round when the worker has not run", async () => {
    const unit = createUnitOfWork();
    let current = now;
    const service = new DispatchService(unit, { now: () => current });
    const round = await service.startDispatch(identity(riderId), requestId);
    const before = unit.snapshot();
    await expect(service.expireRound(round.id)).rejects.toMatchObject({ status: 409 });
    expect(unit.snapshot()).toEqual(before);
    current = new Date(round.expires_at);
    const next = await service.startDispatch(identity(riderId), requestId);
    expect(next.round_number).toBe(2);
    const committed = unit.snapshot();
    await service.expireRound(round.id);
    expect(unit.snapshot()).toEqual(committed);
    expect(committed.dispatchRounds.filter((item) => item.status === "active")).toHaveLength(1);
    expect(committed.outboxEvents.filter((event) => event.topic === "dispatch.round.expired")).toHaveLength(1);
  });

  it("keeps a valid worker lease intact during rider retry or direct expiry", async () => {
    const state = createUnitOfWork().snapshot();
    state.dispatchRounds = [{ id: uuid(100), requestId, roundNumber: 1, radiusMeters: 2000, status: "active",
      startedAt: new Date(now.getTime() - 60000), expiresAt: now, leaseOwner: "worker-a", leaseExpiresAt: new Date(now.getTime() + 60000) }];
    const unit = new InMemoryUnitOfWork(state);
    const service = new DispatchService(unit, { now: () => now });
    await expect(service.startDispatch(identity(riderId), requestId)).rejects.toMatchObject({ status: 409 });
    await expect(service.expireRound(uuid(100))).rejects.toMatchObject({ status: 409 });
    expect(unit.snapshot()).toEqual(state);
  });

  it.each(["dispatch.candidate.expired", "dispatch.request.manual_escalated"])("rolls back %s when its required outbox append fails", async (topic) => {
    const state = createUnitOfWork().snapshot();
    state.serviceRequests[0]!.status = "offered";
    state.dispatchRounds = [{ id: uuid(100), requestId, roundNumber: 1, radiusMeters: 2000, status: "expired",
      startedAt: new Date(now.getTime() - 360000), expiresAt: now }];
    const mechanicId = state.mechanicProfiles[0]!.userId;
    state.dispatchCandidates = [{ id: uuid(101), roundId: uuid(100), requestId, mechanicId, rank: 1, status: "offered", offeredAt: now, expiresAt: now, createdAt: now }];
    const unit = new InMemoryUnitOfWork(state);
    const wrapper: UnitOfWork = { execute: (work) => unit.execute((repos) => {
      vi.spyOn(repos.outbox, "append").mockRejectedValue(new Error("outbox unavailable"));
      return work(repos);
    }) };
    const service = new DispatchService(wrapper, { now: () => now });
    const command = topic === "dispatch.candidate.expired" ? service.declineOffer(identity(mechanicId), uuid(101)) : service.startDispatch(identity(riderId), requestId);
    await expect(command).rejects.toThrow("outbox unavailable");
    expect(unit.snapshot()).toEqual(state);
  });

  it("creates 60-second offers, writes audit/outbox atomically, and supports rejection/cancellation", async () => {
    const ids = sequentialIds([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      "99999999-9999-4999-8999-999999999999",
      "88888888-8888-4888-8888-888888888888",
      "77777777-7777-4777-8777-777777777777",
      ...Array.from({ length: 20 }, (_, index) => uuid(index + 100))
    ]);
    const unitOfWork = createUnitOfWork();
    const service = new DispatchService(unitOfWork, { now: () => now, createId: ids });

    const round = await service.startDispatch(identity(riderId), requestId);

    expect(round.round_number).toBe(1);
    expect(round.radius_m).toBe(DISPATCH_RADIUS_STEPS_KM[0] * 1000);
    expect(new Date(round.expires_at).getTime() - now.getTime()).toBe(
      DISPATCH_OFFER_EXPIRY_SECONDS * 1000
    );
    expect(round.candidates).toHaveLength(2);
    expect(round.candidates[0]).toMatchObject({ rank: 1, status: "offered" });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.serviceRequests.find((request) => request.id === requestId)?.status).toBe(
      "offered"
    );
    expect(snapshot.outboxEvents.filter((event) => event.topic === "dispatch.round.started")).toHaveLength(1);
    expect(snapshot.auditLogs.filter((log) => log.action === "dispatch.round.started")).toHaveLength(1);
    expect(snapshot.notifications).toHaveLength(2);
    expect(JSON.stringify(snapshot.auditLogs)).not.toContain("Xe can ho tro");

    const mechanicIdentity = identity(round.candidates[0]!.mechanic_id);
    await expect(service.listMyOffers(mechanicIdentity)).resolves.toMatchObject({
      items: [{ id: round.candidates[0]!.id }]
    });
    await expect(service.declineOffer(mechanicIdentity, round.candidates[0]!.id)).resolves.toBeUndefined();
    expect(unitOfWork.snapshot().dispatchCandidates.find((item) => item.id === round.candidates[0]!.id)?.status).toBe("rejected");

    await service.cancelDispatchForRequest(requestId);
    expect(unitOfWork.snapshot().dispatchRounds.find((item) => item.id === round.id)?.status).toBe(
      "canceled"
    );
  });

  it("uses four radius rounds and manually escalates after 360 seconds", async () => {
    let current = now;
    const unitOfWork = createUnitOfWork({
      mechanics: [
        mechanic("00000000-0000-4000-8000-000000000001", 10.762622, 106.660172),
        mechanic("00000000-0000-4000-8000-000000000002", 10.79, 106.660172),
        mechanic("00000000-0000-4000-8000-000000000003", 10.82, 106.660172),
        mechanic("00000000-0000-4000-8000-000000000004", 10.86, 106.660172)
      ]
    });
    const service = new DispatchService(unitOfWork, {
      now: () => current,
      createId: sequentialIds(Array.from({ length: 80 }, (_, index) => uuid(index + 1)))
    });

    const created = [];
    for (let index = 0; index < 4; index += 1) {
      const round = await service.startDispatch(identity(riderId), requestId);
      created.push(round);
      current = new Date(current.getTime() + DISPATCH_OFFER_EXPIRY_SECONDS * 1000);
      await service.expireRound(round.id);
    }

    expect(created.map((round) => round.radius_m)).toEqual([2000, 5000, 8000, 12000]);
    expect(current.getTime() - now.getTime()).toBe(DISPATCH_TOTAL_WAIT_SECONDS * 1000 - 120_000);
    expect(unitOfWork.snapshot().serviceRequests.find((request) => request.id === requestId)?.status).toBe(
      "manual_escalation"
    );
  });

  it("rejects active assignment/job conflicts with stable 409 semantics", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new DispatchService(unitOfWork, {
      now: () => now,
      hasActiveAssignment: async () => true
    });

    await expect(service.startDispatch(identity(riderId), requestId)).rejects.toMatchObject({
      status: 409,
      errorCode: "CONFLICT"
    });
  });

  it("uses one eligibility query including workload and excludes busy mechanics", async () => {
    const mechanics = [
      mechanic("00000000-0000-4000-8000-000000000001", 10.762622, 106.660172),
      mechanic("00000000-0000-4000-8000-000000000002", 10.7627, 106.660172),
      mechanic("00000000-0000-4000-8000-000000000003", 10.7628, 106.660172)
    ];
    const workloadSpy = vi.spyOn(
      InMemoryDispatchRepository.prototype,
      "listEligibility"
    );
    const unitOfWork = createUnitOfWork({
      mechanics,
      assignments: [
        assignment("busy", mechanics[0]!.userId, "accepted"),
        assignment("terminal", mechanics[1]!.userId, "completed")
      ]
    });

    const round = await new DispatchService(unitOfWork, { now: () => now }).startDispatch(
      identity(riderId),
      requestId
    );

    expect(round.candidates.map((candidate) => candidate.mechanic_id)).toEqual([
      mechanics[1]!.userId,
      mechanics[2]!.userId
    ]);
    expect(workloadSpy).toHaveBeenCalledTimes(1);
    expect(workloadSpy).toHaveBeenCalledWith(expect.objectContaining({ eligibleOnly: true, requestId }));
    workloadSpy.mockRestore();
  });

  it("creates a controlled empty round when every eligible mechanic is busy", async () => {
    const mechanics = defaultMechanics();
    const unitOfWork = createUnitOfWork({
      mechanics,
      assignments: mechanics.map((item, index) =>
        assignment(`busy-${index}`, item.userId, "in_progress")
      )
    });

    const round = await new DispatchService(unitOfWork, { now: () => now }).startDispatch(
      identity(riderId),
      requestId
    );

    expect(round.candidates).toEqual([]);
    expect(unitOfWork.snapshot().serviceRequests[0]?.status).toBe("dispatching");
  });

  it("excludes future calendar conflicts while allowing exactly adjacent and terminal reservations", async () => {
    const mechanics = [
      mechanic("00000000-0000-4000-8000-000000000001", 10.762622, 106.660172),
      mechanic("00000000-0000-4000-8000-000000000002", 10.7627, 106.660172),
      mechanic("00000000-0000-4000-8000-000000000003", 10.7628, 106.660172)
    ];
    const unitOfWork = createUnitOfWork({ mechanics, assignments: mechanics.map((item, index) => ({
      ...assignment(`calendar-${index}`, item.userId, index === 2 ? "completed" : "accepted"),
      scheduledStartAt: new Date(now.getTime() + 180 * 60_000),
      reservationStartAt: new Date(now.getTime() + (index === 1 ? 150 : 149) * 60_000),
      reservationEndAt: new Date(now.getTime() + 210 * 60_000)
    })) });

    const round = await new DispatchService(unitOfWork, { now: () => now }).startDispatch(identity(riderId), requestId);

    expect(round.candidates.map((candidate) => candidate.mechanic_id)).toEqual([mechanics[1]!.userId, mechanics[2]!.userId]);
  });
});

function createUnitOfWork(
  options: {
    mechanics?: ReturnType<typeof mechanic>[];
    assignments?: Assignment[];
  } = {}
) {
  return new InMemoryUnitOfWork({
    users: [activeUser(riderId), ...(options.mechanics ?? defaultMechanics()).map((item) => activeUser(item.userId))],
    userRoles: [
      { userId: riderId, role: "rider" },
      ...(options.mechanics ?? defaultMechanics()).map((item) => ({
        userId: item.userId,
        role: "mechanic" as const
      }))
    ],
    motorcycles: [
      {
        id: motorcycleId,
        riderId,
        brandText: "Honda",
        modelText: "Wave",
        createdAt: now,
        updatedAt: now
      }
    ],
    serviceRequests: [
      {
        id: requestId,
        requestCode: "COR-MOB-20260625-1",
        riderId,
        motorcycleId,
        serviceType: "mobile_repair",
        problemDescription: "Xe can ho tro",
        status: "submitted",
        priority: "normal",
        serviceLocation: { latitude: 10.762622, longitude: 106.660172 },
        createdAt: now,
        updatedAt: now
      }
    ],
    mechanicProfiles: options.mechanics ?? defaultMechanics(),
    assignments: options.assignments ?? []
  });
}

function assignment(idSuffix: string, mechanicId: string, status: AssignmentStatus): Assignment {
  return {
    id: `assignment-${idSuffix}`,
    requestId: `other-request-${idSuffix}`,
    mechanicId,
    acceptedCandidateId: `candidate-${idSuffix}`,
    status,
    acceptedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

function defaultMechanics() {
  return [
    mechanic("00000000-0000-4000-8000-000000000001", 10.762622, 106.660172, 4.5),
    mechanic("00000000-0000-4000-8000-000000000002", 10.7629, 106.660172, 4.8)
  ];
}

function mechanic(userId: string, latitude: number, longitude: number, ratingAvg = 4) {
  return {
    userId,
    profileStatus: "active" as const,
    isAvailable: true,
    serviceRadiusKm: 20,
    latestLocation: { latitude, longitude },
    locationUpdatedAt: now,
    availabilityUpdatedAt: now,
    ratingAvg,
    ratingCount: 1,
    serviceTypes: ["mobile_repair" as const],
    createdAt: now,
    updatedAt: now
  };
}

function activeUser(id: string) {
  return { id, status: "active" as const, createdAt: now, updatedAt: now };
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return {
    subject,
    issuer: "https://careonroad.supabase.co/auth/v1",
    audience: ["authenticated"]
  };
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

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}
