import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { ServiceRequestService } from "@/features/service-requests/service-request.service";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AcceptAssignmentService } from "../accept-assignment.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const mechanicA = "22222222-2222-4222-8222-222222222222";
const mechanicB = "33333333-3333-4333-8333-333333333333";
const motorcycleId = "44444444-4444-4444-8444-444444444444";
const requestA = "55555555-5555-4555-8555-555555555555";
const requestB = "66666666-6666-4666-8666-666666666666";
const roundA = "77777777-7777-4777-8777-777777777777";
const roundB = "88888888-8888-4888-8888-888888888888";
const offerA1 = "99999999-9999-4999-8999-999999999991";
const offerA2 = "99999999-9999-4999-8999-999999999992";
const offerB1 = "99999999-9999-4999-8999-999999999993";
const now = new Date("2026-06-25T05:00:00Z");

describe("assignment accept conflict behavior", () => {
  it("lets the first valid mechanic accept win for one request", async () => {
    const unitOfWork = createUnitOfWork({ includeSecondMechanicOffer: true });
    const service = acceptService(unitOfWork);

    const outcomes = await Promise.allSettled([
      service.acceptOffer(identity(mechanicA), offerA1),
      service.acceptOffer(identity(mechanicB), offerA2)
    ]);
    expect(outcomes[0]).toMatchObject({
      status: "fulfilled",
      value: { request_id: requestA, mechanic_id: mechanicA }
    });
    expect(outcomes[1]).toMatchObject({
      status: "rejected",
      reason: { status: 409, errorCode: "CONFLICT" }
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.assignments).toHaveLength(1);
    expect(snapshot.dispatchCandidates.find((candidate) => candidate.id === offerA1)?.status).toBe(
      "accepted"
    );
    expect(snapshot.dispatchCandidates.find((candidate) => candidate.id === offerA2)?.status).toBe(
      "cancelled"
    );
    expect(snapshot.assignmentStatusHistory).toHaveLength(1);
    expect(snapshot.serviceRequests.find((request) => request.id === requestA)?.status).toBe(
      "assigned"
    );
  });

  it("rejects one mechanic accepting two active requests and leaves no losing residue", async () => {
    const unitOfWork = createUnitOfWork({ includeSecondRequest: true });
    const service = acceptService(unitOfWork);

    const outcomes = await Promise.allSettled([
      service.acceptOffer(identity(mechanicA), offerA1),
      service.acceptOffer(identity(mechanicA), offerB1)
    ]);
    expect(outcomes[0]).toMatchObject({
      status: "fulfilled",
      value: { request_id: requestA }
    });
    expect(outcomes[1]).toMatchObject({
      status: "rejected",
      reason: { status: 409, errorCode: "CONFLICT" }
    });
    const after = unitOfWork.snapshot();

    expect(after.assignments).toHaveLength(1);
    expect(after.assignmentStatusHistory).toHaveLength(1);
    expect(after.auditLogs).toHaveLength(2);
    expect(after.outboxEvents).toHaveLength(2);
    expect(after.dispatchCandidates.find((candidate) => candidate.id === offerB1)?.status).toBe(
      "offered"
    );
  });

  it("handles rider cancel before accept with no assignment residue", async () => {
    const unitOfWork = createUnitOfWork();
    const cancelService = new ServiceRequestService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
      ])
    });
    const outcomes = await Promise.allSettled([
      cancelService.cancelServiceRequest(identity(riderId), requestA, {
        reason: "rider_cancel"
      }),
      acceptService(unitOfWork).acceptOffer(identity(mechanicA), offerA1)
    ]);
    expect(outcomes[0].status).toBe("fulfilled");
    expect(outcomes[1]).toMatchObject({
      status: "rejected",
      reason: { status: 409, errorCode: "CONFLICT" }
    });
    const afterAcceptLoss = unitOfWork.snapshot();

    expect(afterAcceptLoss.assignments).toHaveLength(0);
    expect(afterAcceptLoss.assignmentStatusHistory).toHaveLength(0);
    expect(afterAcceptLoss.requestStatusHistory).toHaveLength(1);
    expect(afterAcceptLoss.auditLogs).toHaveLength(1);
    expect(afterAcceptLoss.outboxEvents).toHaveLength(1);
    expect(afterAcceptLoss.serviceRequests.find((request) => request.id === requestA)?.status).toBe(
      "canceled"
    );
    expect(afterAcceptLoss.dispatchRounds[0]?.status).toBe("canceled");
    expect(afterAcceptLoss.dispatchCandidates[0]?.status).toBe("cancelled");
  });

  it("handles accept before rider cancel without a canceled active assignment", async () => {
    const unitOfWork = createUnitOfWork();
    const cancelService = new ServiceRequestService(unitOfWork, {
        now: () => now,
        createId: sequentialIds([
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
        ])
      });
    const outcomes = await Promise.allSettled([
      acceptService(unitOfWork).acceptOffer(identity(mechanicA), offerA1),
      cancelService.cancelServiceRequest(identity(riderId), requestA, { reason: "late_cancel" })
    ]);
    expect(outcomes[0].status).toBe("fulfilled");
    expect(outcomes[1]).toMatchObject({
      status: "rejected",
      reason: { status: 409, errorCode: "CONFLICT" }
    });

    const afterCancelLoss = unitOfWork.snapshot();
    expect(afterCancelLoss.assignments).toHaveLength(1);
    expect(afterCancelLoss.assignments[0]?.status).toBe("accepted");
    expect(afterCancelLoss.serviceRequests.find((request) => request.id === requestA)?.status).toBe(
      "assigned"
    );
    expect(afterCancelLoss.assignmentStatusHistory).toHaveLength(1);
    expect(afterCancelLoss.requestStatusHistory).toHaveLength(1);
    expect(afterCancelLoss.auditLogs).toHaveLength(2);
    expect(afterCancelLoss.outboxEvents).toHaveLength(2);
    expect(
      afterCancelLoss.serviceRequests.some(
        (request) =>
          request.status === "canceled" &&
          afterCancelLoss.assignments.some(
            (assignment) =>
              assignment.requestId === request.id &&
              ["accepted", "en_route", "on_site", "diagnosis", "quoted", "awaiting_payment", "in_progress"].includes(
                assignment.status
              )
          )
      )
    ).toBe(false);
  });
});

function createUnitOfWork(
  options: { includeSecondMechanicOffer?: boolean; includeSecondRequest?: boolean } = {}
) {
  return new InMemoryUnitOfWork({
    users: [activeUser(riderId), activeUser(mechanicA), activeUser(mechanicB)],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: mechanicA, role: "mechanic" },
      { userId: mechanicB, role: "mechanic" }
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
      serviceRequest(requestA, "COR-MOB-20260625-1"),
      ...(options.includeSecondRequest
        ? [serviceRequest(requestB, "COR-MOB-20260625-2")]
        : [])
    ],
    mechanicProfiles: [mechanic(mechanicA), mechanic(mechanicB)],
    dispatchRounds: [
      round(roundA, requestA),
      ...(options.includeSecondRequest ? [round(roundB, requestB)] : [])
    ],
    dispatchCandidates: [
      candidate(offerA1, roundA, requestA, mechanicA, 1),
      ...(options.includeSecondMechanicOffer ? [candidate(offerA2, roundA, requestA, mechanicB, 2)] : []),
      ...(options.includeSecondRequest ? [candidate(offerB1, roundB, requestB, mechanicA, 1)] : [])
    ]
  });
}

function acceptService(unitOfWork: InMemoryUnitOfWork) {
  return new AcceptAssignmentService(unitOfWork, {
    now: () => now,
    createId: sequentialIds(Array.from({ length: 20 }, (_, index) => uuid(index + 1)))
  });
}

function serviceRequest(id: string, requestCode: string) {
  return {
    id,
    requestCode,
    riderId,
    motorcycleId,
    serviceType: "mobile_repair" as const,
    problemDescription: "Xe can ho tro",
    status: "offered" as const,
    priority: "normal" as const,
    serviceLocation: { latitude: 10.762622, longitude: 106.660172 },
    createdAt: now,
    updatedAt: now
  };
}

function round(id: string, requestId: string) {
  return {
    id,
    requestId,
    roundNumber: 1,
    radiusMeters: 2000,
    status: "active" as const,
    startedAt: now,
    expiresAt: new Date(now.getTime() + 60_000)
  };
}

function candidate(
  id: string,
  roundId: string,
  requestId: string,
  mechanicId: string,
  rank: number
) {
  return {
    id,
    roundId,
    requestId,
    mechanicId,
    rank,
    distanceMeters: rank * 10,
    status: "offered" as const,
    offeredAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    createdAt: now
  };
}

function mechanic(userId: string) {
  return {
    userId,
    profileStatus: "active" as const,
    isAvailable: true,
    serviceRadiusKm: 20,
    latestLocation: { latitude: 10.762622, longitude: 106.660172 },
    locationUpdatedAt: now,
    availabilityUpdatedAt: now,
    ratingAvg: 4,
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
