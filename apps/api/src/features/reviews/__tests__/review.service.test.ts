import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { ReviewService } from "../review.service";

const RIDER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_RIDER_ID = "22222222-2222-4222-8222-222222222222";
const MECHANIC_ID = "33333333-3333-4333-8333-333333333333";
const ADMIN_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const ASSIGNMENT_ID = "66666666-6666-4666-8666-666666666666";
const ACTIVE_ASSIGNMENT_ID = "77777777-7777-4777-8777-777777777777";
const NOW = new Date("2026-08-23T08:00:00.000Z");

describe("ReviewService", () => {
  it("creates one immutable completed-owner review under concurrent exact submissions", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new ReviewService(unitOfWork, { now: () => NOW });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        service.createReview(
          identity(RIDER_ID),
          ASSIGNMENT_ID,
          { rating: 5, comment: "  Nhanh và rõ ràng  " },
          `review-concurrent-${index}`
        )
      )
    );
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(results[0]).toMatchObject({
      assignment_id: ASSIGNMENT_ID,
      mechanic_id: MECHANIC_ID,
      rating: 5,
      comment: "Nhanh và rõ ràng",
      mechanic_rating: { average: 5, count: 1 }
    });
    expect(results[0]).not.toHaveProperty("rider_id");
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.serviceReviews).toHaveLength(1);
    expect(snapshot.mechanicProfiles[0]).toMatchObject({ ratingAvg: 5, ratingCount: 1 });
    expect(snapshot.auditLogs).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(JSON.stringify([...snapshot.auditLogs, ...snapshot.outboxEvents])).not.toMatch(
      /Nhanh|rider_id|review-concurrent/
    );
  });

  it("replays equal payload and conflicts immutable changed payload", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new ReviewService(unitOfWork, { now: () => NOW });
    const first = await service.createReview(
      identity(RIDER_ID), ASSIGNMENT_ID, { rating: 4 }, "immutable-review-1"
    );
    await expect(
      service.createReview(identity(RIDER_ID), ASSIGNMENT_ID, { rating: 4 }, "immutable-review-2")
    ).resolves.toMatchObject({ id: first.id, rating: 4 });
    await expect(
      service.createReview(identity(RIDER_ID), ASSIGNMENT_ID, { rating: 3 }, "immutable-review-3")
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    expect(unitOfWork.snapshot().serviceReviews).toHaveLength(1);
    expect(unitOfWork.snapshot().mechanicProfiles[0]).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
  });

  it("rejects foreign/non-rider actors, active workflows, invalid ratings, and comment overflow", async () => {
    const service = new ReviewService(createUnitOfWork(), { now: () => NOW });
    await expect(
      service.createReview(identity(OTHER_RIDER_ID), ASSIGNMENT_ID, { rating: 5 }, "foreign-review")
    ).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    await expect(
      service.createReview(identity(MECHANIC_ID), ASSIGNMENT_ID, { rating: 5 }, "self-review-1")
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      service.createReview(identity(ADMIN_ID), ASSIGNMENT_ID, { rating: 5 }, "admin-review-1")
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      service.createReview(identity(RIDER_ID), ACTIVE_ASSIGNMENT_ID, { rating: 5 }, "active-review-1")
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    for (const rating of [0, 1.5, 6, "5", true]) {
      await expect(
        service.createReview(identity(RIDER_ID), ASSIGNMENT_ID, { rating }, `invalid-${String(rating)}-key`)
      ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    }
    await expect(
      service.createReview(
        identity(RIDER_ID), ASSIGNMENT_ID, { rating: 5, comment: "x".repeat(1001) }, "long-comment"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
  });
});

function identity(subject: string) {
  return { subject, issuer: "issuer", audience: ["authenticated"] };
}

function createUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [RIDER_ID, OTHER_RIDER_ID, MECHANIC_ID, ADMIN_ID].map((id) => ({
      id, status: "active" as const, createdAt: NOW, updatedAt: NOW
    })),
    userRoles: [
      { userId: RIDER_ID, role: "rider" },
      { userId: OTHER_RIDER_ID, role: "rider" },
      { userId: MECHANIC_ID, role: "mechanic" },
      { userId: ADMIN_ID, role: "admin" }
    ],
    mechanicProfiles: [{
      userId: MECHANIC_ID,
      profileStatus: "active",
      isAvailable: false,
      serviceRadiusKm: 10,
      availabilityUpdatedAt: NOW,
      ratingAvg: 4.85,
      ratingCount: 127,
      serviceTypes: ["mobile_repair"],
      createdAt: NOW,
      updatedAt: NOW
    }],
    serviceRequests: [{
      id: REQUEST_ID,
      requestCode: "COR-MOB-20260823-1",
      riderId: RIDER_ID,
      motorcycleId: "88888888-8888-4888-8888-888888888888",
      serviceType: "mobile_repair",
      problemDescription: "Xe không nổ máy",
      status: "completed",
      priority: "normal",
      createdAt: NOW,
      updatedAt: NOW
    }],
    assignments: [
      assignment(ASSIGNMENT_ID, "completed"),
      assignment(ACTIVE_ASSIGNMENT_ID, "in_progress")
    ]
  });
}

function assignment(id: string, status: "completed" | "in_progress") {
  return {
    id,
    requestId: REQUEST_ID,
    mechanicId: MECHANIC_ID,
    acceptedCandidateId: id.replace(/^./, "9"),
    status,
    acceptedAt: new Date(NOW.getTime() - 60_000),
    ...(status === "completed" ? { completedAt: NOW } : {}),
    createdAt: new Date(NOW.getTime() - 60_000),
    updatedAt: NOW
  };
}
