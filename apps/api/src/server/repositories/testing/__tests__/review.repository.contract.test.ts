import { describe, expect, it } from "vitest";

import type { MechanicProfile } from "../../contracts/mechanic.repository";
import type { ServiceReview } from "../../contracts/review.repository";
import { InMemoryReviewRepository } from "../in-memory-review.repository";

const NOW = new Date("2026-08-23T08:00:00.000Z");

describe("review repository contract", () => {
  it("creates one canonical assignment review and rebuilds rounded aggregate", async () => {
    const reviews: ServiceReview[] = [];
    const profiles = [profile("11111111-1111-4111-8111-111111111111")];
    const repository = new InMemoryReviewRepository(reviews, profiles);
    const input = review("22222222-2222-4222-8222-222222222222", 4);
    await expect(repository.createIfAbsent(input)).resolves.toMatchObject({ created: true });
    await expect(repository.createIfAbsent({ ...input, id: "33333333-3333-4333-8333-333333333333" })).resolves.toMatchObject({
      created: false,
      review: { id: input.id }
    });
    await repository.createIfAbsent(review("44444444-4444-4444-8444-444444444444", 5));
    await expect(repository.rebuildMechanicRating(input.mechanicId, NOW)).resolves.toEqual({
      mechanicId: input.mechanicId,
      ratingAvg: 4.5,
      ratingCount: 2
    });
  });
});

function profile(userId: string): MechanicProfile {
  return {
    userId,
    profileStatus: "active",
    isAvailable: false,
    serviceRadiusKm: 10,
    availabilityUpdatedAt: NOW,
    ratingAvg: 0,
    ratingCount: 0,
    serviceTypes: [],
    createdAt: NOW,
    updatedAt: NOW
  };
}

function review(assignmentId: string, rating: number): ServiceReview {
  return {
    id: assignmentId.replace(/^./, "9"),
    assignmentId,
    requestId: assignmentId.replace(/^./, "8"),
    riderId: "77777777-7777-4777-8777-777777777777",
    mechanicId: "11111111-1111-4111-8111-111111111111",
    rating,
    createdAt: NOW
  };
}
