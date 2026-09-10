import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { ReviewRatingRebuildWorker } from "../review-rating-rebuild.worker";

const NOW = new Date("2026-08-23T08:00:00.000Z");

describe("ReviewRatingRebuildWorker", () => {
  it("rebuilds reviewed and zero-review profiles idempotently", async () => {
    const unitOfWork = new InMemoryUnitOfWork({
      mechanicProfiles: [profile("11111111-1111-4111-8111-111111111111"), profile("22222222-2222-4222-8222-222222222222")],
      serviceReviews: [review(5, 1), review(4, 2), review(4, 3)]
    });
    const worker = new ReviewRatingRebuildWorker(unitOfWork, { now: () => NOW });
    await expect(worker.rebuild()).resolves.toEqual({ mechanics_rebuilt: 2 });
    await expect(worker.rebuild()).resolves.toEqual({ mechanics_rebuilt: 2 });
    expect(unitOfWork.snapshot().mechanicProfiles).toEqual([
      expect.objectContaining({ ratingAvg: 4.33, ratingCount: 3 }),
      expect.objectContaining({ ratingAvg: 0, ratingCount: 0 })
    ]);
  });
});

function profile(userId: string) {
  return {
    userId,
    profileStatus: "active" as const,
    isAvailable: false,
    serviceRadiusKm: 10,
    availabilityUpdatedAt: NOW,
    ratingAvg: 5,
    ratingCount: 99,
    serviceTypes: ["mobile_repair" as const],
    createdAt: NOW,
    updatedAt: NOW
  };
}

function review(rating: number, index: number) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    assignmentId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    requestId: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    riderId: "33333333-3333-4333-8333-333333333333",
    mechanicId: "11111111-1111-4111-8111-111111111111",
    rating,
    createdAt: NOW
  };
}
