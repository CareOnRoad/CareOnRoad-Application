import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { Assignment } from "@/server/repositories/contracts/assignment.repository";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AcceptAssignmentService } from "../accept-assignment.service";
import { AssignmentService } from "../assignment.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const mechanicId = "22222222-2222-4222-8222-222222222222";
const otherMechanicId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const motorcycleId = "55555555-5555-4555-8555-555555555555";
const requestId = "66666666-6666-4666-8666-666666666666";
const roundId = "77777777-7777-4777-8777-777777777777";
const offerId = "88888888-8888-4888-8888-888888888888";
const otherOfferId = "99999999-9999-4999-8999-999999999999";
const now = new Date("2026-06-25T05:00:00Z");

describe("assignment service", () => {
  it("requires the current mechanic role even for the assignment owner", async () => {
    const seed = createUnitOfWork();
    const accepted = await new AcceptAssignmentService(seed, { now: () => now }).acceptOffer(identity(mechanicId), offerId);
    const state = seed.snapshot();
    state.userRoles = state.userRoles.filter((role) => role.userId !== mechanicId);
    state.userRoles.push({ userId: mechanicId, role: "rider" });
    const unit = new InMemoryUnitOfWork(state);
    await expect(new AssignmentService(unit).transitionAssignment(identity(mechanicId), accepted.id, { status: "en_route" }))
      .rejects.toMatchObject({ status: 403 });
    expect(unit.snapshot().assignmentStatusHistory).toEqual(state.assignmentStatusHistory);
  });

  it("unions rider and mechanic ownership without duplicating assignments", async () => {
    const seed = createUnitOfWork();
    const accepted = await new AcceptAssignmentService(seed, { now: () => now }).acceptOffer(identity(mechanicId), offerId);
    const state = seed.snapshot();
    state.userRoles.push({ userId: riderId, role: "mechanic" });
    const list = (value: typeof state) => new AssignmentService(new InMemoryUnitOfWork(value)).listAssignments(identity(riderId));
    expect((await list(state)).items.map((item) => item.id)).toEqual([accepted.id]);
    state.assignments[0]!.mechanicId = riderId;
    expect((await list(state)).items.map((item) => item.id)).toEqual([accepted.id]);
    state.userRoles = state.userRoles.filter((role) => role.userId !== riderId);
    expect((await list(state)).items).toEqual([]);
  });

  it("filters out terminal statuses when active_only=true", async () => {
    const seed = createUnitOfWork();
    const accepted = await new AcceptAssignmentService(seed, { now: () => now }).acceptOffer(identity(mechanicId), offerId);
    const state = seed.snapshot();
    // Add a second assignment ở trạng thái terminal (completed) thuộc cùng mechanic.
    state.assignments.push({
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      requestId: "aaaaaaaa-0000-4000-8000-000000000001",
      mechanicId,
      acceptedCandidateId: "aaaaaaaa-0000-4000-8000-000000000002",
      status: "completed",
      acceptedAt: now,
      createdAt: now,
      updatedAt: now
    });
    const service = new AssignmentService(new InMemoryUnitOfWork(state));
    // active_only=true → exclude completed, chỉ trả về assignment active.
    const activeOnly = await service.listAssignments(identity(mechanicId), { active_only: true, limit: 50 });
    expect(activeOnly.items.map((item) => item.id)).toEqual([accepted.id]);
    // active_only không truyền → trả cả completed.
    const all = await service.listAssignments(identity(mechanicId), { limit: 50 });
    expect(all.items).toHaveLength(2);
  });

  it("accepts the first valid offer atomically and cancels competing offers", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new AcceptAssignmentService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
      ])
    });

    const assignment = await service.acceptOffer(identity(mechanicId), offerId);

    expect(assignment).toMatchObject({
      request_id: requestId,
      mechanic_id: mechanicId,
      accepted_candidate_id: offerId,
      status: "accepted"
    });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.assignments).toHaveLength(1);
    expect(snapshot.assignmentStatusHistory).toHaveLength(1);
    expect(snapshot.serviceRequests.find((request) => request.id === requestId)?.status).toBe(
      "assigned"
    );
    expect(snapshot.dispatchCandidates.find((candidate) => candidate.id === offerId)?.status).toBe(
      "accepted"
    );
    expect(
      snapshot.dispatchCandidates.find((candidate) => candidate.id === otherOfferId)?.status
    ).toBe("cancelled");
    expect(snapshot.dispatchRounds.find((round) => round.id === roundId)?.status).toBe(
      "accepted"
    );
    expect(snapshot.outboxEvents).toHaveLength(2);
    expect(snapshot.auditLogs).toHaveLength(2);
    expect(JSON.stringify(snapshot.auditLogs)).not.toContain("Xe can ho tro");
  });

  it("enforces assigned-mechanic/admin authorization, transitions, and active conflicts", async () => {
    const unitOfWork = createUnitOfWork({
      assignments: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          requestId,
          mechanicId,
          acceptedCandidateId: offerId,
          status: "accepted",
          acceptedAt: now,
          createdAt: now,
          updatedAt: now
        }
      ],
      requestStatus: "assigned",
      candidateStatus: "accepted"
    });
    const service = new AssignmentService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        "ffffffff-ffff-4fff-8fff-ffffffffffff",
        "aaaaaaaa-0000-4000-8000-000000000001",
        "aaaaaaaa-0000-4000-8000-000000000002",
        "aaaaaaaa-0000-4000-8000-000000000003"
      ])
    });

    await expect(
      service.transitionAssignment(identity(otherMechanicId), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
        status: "en_route"
      })
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });

    const enRoute = await service.transitionAssignment(
      identity(mechanicId),
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      { status: "en_route" }
    );
    expect(enRoute.status).toBe("en_route");
    expect(unitOfWork.snapshot().serviceRequests.find((request) => request.id === requestId)?.status).toBe(
      "mechanic_en_route"
    );

    const adminTransition = await service.transitionAssignment(
      identity(adminId),
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      { status: "on_site", reason: "admin_update" }
    );
    expect(adminTransition.status).toBe("on_site");

    await expect(
      service.transitionAssignment(identity(mechanicId), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
        status: "accepted"
      })
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });

    const conflictUnit = createUnitOfWork({
      secondRequest: true,
      assignments: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          requestId: "aaaaaaaa-0000-4000-8000-000000000001",
          mechanicId,
          acceptedCandidateId: "aaaaaaaa-0000-4000-8000-000000000002",
          status: "accepted",
          acceptedAt: now,
          createdAt: now,
          updatedAt: now
        }
      ]
    });
    await expect(
      new AcceptAssignmentService(conflictUnit, { now: () => now }).acceptOffer(
        identity(mechanicId),
        offerId
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });
});

function createUnitOfWork(
  options: {
    assignments?: Assignment[];
    requestStatus?: "offered" | "assigned";
    candidateStatus?: "offered" | "accepted";
    secondRequest?: boolean;
  } = {}
) {
  const secondRequestId = "aaaaaaaa-0000-4000-8000-000000000001";
  return new InMemoryUnitOfWork({
    users: [activeUser(riderId), activeUser(mechanicId), activeUser(otherMechanicId), activeUser(adminId)],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" },
      { userId: otherMechanicId, role: "mechanic" },
      { userId: adminId, role: "admin" }
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
      request(requestId, options.requestStatus ?? "offered"),
      ...(options.secondRequest ? [request(secondRequestId, "assigned")] : [])
    ],
    mechanicProfiles: [mechanic(mechanicId), mechanic(otherMechanicId)],
    dispatchRounds: [
      {
        id: roundId,
        requestId,
        roundNumber: 1,
        radiusMeters: 2000,
        status: "active",
        startedAt: now,
        expiresAt: new Date(now.getTime() + 60_000)
      }
    ],
    dispatchCandidates: [
      candidate(offerId, mechanicId, options.candidateStatus ?? "offered"),
      candidate(otherOfferId, otherMechanicId, "offered"),
      ...(options.secondRequest
        ? [candidate("aaaaaaaa-0000-4000-8000-000000000002", mechanicId, "accepted", secondRequestId)]
        : [])
    ],
    assignments: options.assignments ?? []
  });
}

function request(id: string, status: "offered" | "assigned") {
  return {
    id,
    requestCode: id === requestId ? "COR-MOB-20260625-1" : "COR-MOB-20260625-2",
    riderId,
    motorcycleId,
    serviceType: "mobile_repair" as const,
    problemDescription: "Xe can ho tro",
    status,
    priority: "normal" as const,
    serviceLocation: { latitude: 10.762622, longitude: 106.660172 },
    createdAt: now,
    updatedAt: now
  };
}

function candidate(
  id: string,
  mechanicIdInput: string,
  status: "offered" | "accepted",
  requestIdInput = requestId
) {
  return {
    id,
    roundId,
    requestId: requestIdInput,
    mechanicId: mechanicIdInput,
    rank: mechanicIdInput === mechanicId ? 1 : 2,
    distanceMeters: 20,
    status,
    offeredAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    ...(status === "accepted" ? { respondedAt: now } : {}),
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
  let extraId = 1000;
  return () => {
    const id = ids.shift() ?? `aaaaaaaa-0000-4000-8000-${String(extraId++).padStart(12, "0")}`;
    if (!id) {
      throw new Error("Test ID sequence exhausted.");
    }
    return id;
  };
}
