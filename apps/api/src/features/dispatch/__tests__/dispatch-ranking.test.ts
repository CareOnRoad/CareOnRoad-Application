import { describe, expect, it } from "vitest";

import type { DispatchCandidateMechanic } from "@/server/repositories/contracts/dispatch.repository";
import { InMemoryDispatchRepository } from "@/server/repositories/testing/in-memory-dispatch.repository";

import {
  DISPATCH_CANDIDATE_BATCH_SIZE,
  DISPATCH_LOCATION_MAX_AGE_SECONDS,
  DISPATCH_RADIUS_STEPS_KM,
  isDispatchLocationFresh,
  rankDispatchCandidates
} from "../dispatch-ranking";

const now = new Date("2026-06-25T05:00:00Z");

describe("dispatch ranking", () => {
  it("orders eligible mechanics deterministically and keeps zero-count ratings eligible", () => {
    const ranked = rankDispatchCandidates(
      [
        candidate("cccccccc-cccc-4ccc-8ccc-cccccccccccc", {
          distanceMeters: 500,
          ratingAvg: 4.6,
          ratingCount: 0
        }),
        candidate("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", {
          distanceMeters: 500,
          ratingAvg: 4.8,
          activeWorkloadCount: 1
        }),
        candidate("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
          distanceMeters: 500,
          ratingAvg: 4.8,
          activeWorkloadCount: 0,
          availabilityUpdatedAt: new Date("2026-06-25T04:50:00Z")
        }),
        candidate("dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
          distanceMeters: 300,
          ratingAvg: 2.0
        }),
        candidate("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", {
          distanceMeters: 500,
          ratingAvg: 4.8
        })
      ],
      new Map([
        ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", { activeWorkloadCount: 1 }],
        ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", { activeWorkloadCount: 2 }]
      ])
    );

    expect(ranked.map((item) => item.mechanicId)).toEqual([
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    ]);
    expect(ranked.find((item) => item.ratingCount === 0)).toBeDefined();
  });

  it("uses a stable mechanic identifier tie-break across repeated ranking", () => {
    const mechanics = [
      candidate("cccccccc-cccc-4ccc-8ccc-cccccccccccc", {}),
      candidate("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {}),
      candidate("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", {})
    ];
    const expected = [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    ];

    for (let index = 0; index < 100; index += 1) {
      expect(rankDispatchCandidates(mechanics).map((item) => item.mechanicId)).toEqual(expected);
    }
  });

  it("applies radius steps, batch size, and 300-second freshness boundaries", async () => {
    const repository = new InMemoryDispatchRepository(
      [],
      [],
      [
        profile("fresh", {
          location: { latitude: 10.762622, longitude: 106.660172 },
          locationUpdatedAt: new Date(now.getTime() - DISPATCH_LOCATION_MAX_AGE_SECONDS * 1000)
        }),
        profile("stale", {
          location: { latitude: 10.763, longitude: 106.661 },
          locationUpdatedAt: new Date(now.getTime() - DISPATCH_LOCATION_MAX_AGE_SECONDS * 1000 - 1)
        }),
        profile("missing-location", { location: undefined, locationUpdatedAt: undefined }),
        profile("wrong-skill", {
          location: { latitude: 10.7627, longitude: 106.6602 },
          serviceTypes: ["periodic_maintenance"]
        }),
        profile("unavailable", {
          location: { latitude: 10.7627, longitude: 106.6602 },
          isAvailable: false
        }),
        profile("outside-radius", {
          location: { latitude: 10.9, longitude: 106.8 },
          serviceRadiusKm: 100
        }),
        ...Array.from({ length: 12 }, (_, index) =>
          profile(`batch-${index}`, {
            location: { latitude: 10.762622 + index * 0.00001, longitude: 106.660172 },
            ratingAvg: 5 - index * 0.01
          })
        )
      ]
    );

    const mechanics = await repository.findCandidateMechanics({
      serviceType: "mobile_repair",
      origin: { latitude: 10.762622, longitude: 106.660172 },
      radiusMeters: DISPATCH_RADIUS_STEPS_KM[0] * 1000,
      now,
      maxLocationAgeSeconds: DISPATCH_LOCATION_MAX_AGE_SECONDS
    });
    const ranked = rankDispatchCandidates(mechanics);

    expect(isDispatchLocationFresh(new Date(now.getTime() - 300_000), now)).toBe(true);
    expect(isDispatchLocationFresh(new Date(now.getTime() - 300_001), now)).toBe(false);
    expect(DISPATCH_RADIUS_STEPS_KM).toEqual([2, 5, 8, 12]);
    expect(ranked).toHaveLength(DISPATCH_CANDIDATE_BATCH_SIZE);
    expect(ranked.map((item) => item.mechanicId)).not.toContain("stale");
    expect(ranked.map((item) => item.mechanicId)).not.toContain("missing-location");
    expect(ranked.map((item) => item.mechanicId)).not.toContain("wrong-skill");
    expect(ranked.map((item) => item.mechanicId)).not.toContain("unavailable");
    expect(ranked.map((item) => item.mechanicId)).not.toContain("outside-radius");
  });
});

function candidate(
  mechanicId: string,
  overrides: Partial<DispatchCandidateMechanic & { activeWorkloadCount: number }>
): DispatchCandidateMechanic {
  return {
    mechanicId,
    serviceTypes: ["mobile_repair"],
    isAvailable: true,
    profileStatus: "active",
    serviceRadiusKm: 20,
    latestLocation: { latitude: 10.762622, longitude: 106.660172 },
    locationUpdatedAt: now,
    availabilityUpdatedAt: new Date("2026-06-25T04:55:00Z"),
    ratingAvg: 4,
    ratingCount: 10,
    distanceMeters: 1000,
    ...overrides
  };
}

function profile(
  idSuffix: string,
  overrides: {
    location?: { latitude: number; longitude: number };
    locationUpdatedAt?: Date;
    serviceTypes?: DispatchCandidateMechanic["serviceTypes"];
    serviceRadiusKm?: number;
    isAvailable?: boolean;
    ratingAvg?: number;
  }
) {
  const location = overrides.location;
  return {
    userId: `00000000-0000-4000-8000-${idSuffix.padStart(12, "0").slice(0, 12)}`,
    profileStatus: "active" as const,
    isAvailable: overrides.isAvailable ?? true,
    serviceRadiusKm: overrides.serviceRadiusKm ?? 20,
    latestLocation: location,
    locationUpdatedAt: overrides.locationUpdatedAt ?? (location ? now : undefined),
    availabilityUpdatedAt: now,
    ratingAvg: overrides.ratingAvg ?? 4,
    ratingCount: 1,
    serviceTypes: overrides.serviceTypes ?? ["mobile_repair"],
    createdAt: now,
    updatedAt: now
  };
}
