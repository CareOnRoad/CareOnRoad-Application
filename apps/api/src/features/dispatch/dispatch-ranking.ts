import type { DispatchCandidateMechanic } from "@/server/repositories/contracts/dispatch.repository";
import type { GeoPoint } from "@/server/repositories/contracts/mechanic.repository";

export const DISPATCH_RADIUS_STEPS_KM = [2, 5, 8, 12] as const;
export const DISPATCH_CANDIDATE_BATCH_SIZE = 10;
export const DISPATCH_OFFER_EXPIRY_SECONDS = 60;
export const DISPATCH_MAX_ROUNDS = 4;
export const DISPATCH_TOTAL_WAIT_SECONDS = 360;
export const DISPATCH_LOCATION_MAX_AGE_SECONDS = 300;
export type CandidateWorkload = {
  activeWorkloadCount: number;
};

export type RankedDispatchCandidate = DispatchCandidateMechanic & {
  activeWorkloadCount: number;
};

export function rankDispatchCandidates(
  mechanics: DispatchCandidateMechanic[],
  workloads: ReadonlyMap<string, CandidateWorkload> = new Map(),
  batchSize = DISPATCH_CANDIDATE_BATCH_SIZE
): RankedDispatchCandidate[] {
  return mechanics
    .filter((mechanic) => mechanic.isAvailable)
    .filter((mechanic) => mechanic.profileStatus === "active")
    .filter(
      (mechanic) => (workloads.get(mechanic.mechanicId)?.activeWorkloadCount ?? 0) === 0
    )
    .map((mechanic) => ({
      ...mechanic,
      activeWorkloadCount: workloads.get(mechanic.mechanicId)?.activeWorkloadCount ?? 0
    }))
    .sort(compareCandidates)
    .slice(0, batchSize);
}

export function isDispatchLocationFresh(
  locationUpdatedAt: Date | undefined,
  now: Date,
  maxAgeSeconds = DISPATCH_LOCATION_MAX_AGE_SECONDS
): boolean {
  if (!locationUpdatedAt) {
    return false;
  }
  return now.getTime() - locationUpdatedAt.getTime() <= maxAgeSeconds * 1000;
}

export function distanceMeters(left: GeoPoint, right: GeoPoint): number {
  const earthRadiusMeters = 6_371_000;
  const leftLat = toRadians(left.latitude);
  const rightLat = toRadians(right.latitude);
  const deltaLat = toRadians(right.latitude - left.latitude);
  const deltaLon = toRadians(right.longitude - left.longitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLon / 2) ** 2;
  return Math.round(
    earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function compareCandidates(left: RankedDispatchCandidate, right: RankedDispatchCandidate): number {
  return (
    left.distanceMeters - right.distanceMeters ||
    right.ratingAvg - left.ratingAvg ||
    left.activeWorkloadCount - right.activeWorkloadCount ||
    left.availabilityUpdatedAt.getTime() - right.availabilityUpdatedAt.getTime() ||
    left.mechanicId.localeCompare(right.mechanicId)
  );
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
