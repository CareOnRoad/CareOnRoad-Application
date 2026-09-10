import { describe, expect, it, vi } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { ExpiringSingleFlightCache } from "../route-eta.cache";
import { RouteEtaProviderError, type RouteEtaProvider } from "../route-eta.provider";
import { RouteEtaService } from "../route-eta.service";

const now = new Date("2026-08-23T07:00:00.000Z");
const riderId = "11111111-1111-4111-8111-111111111111";
const mechanicId = "22222222-2222-4222-8222-222222222222";
const otherRiderId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const assignmentId = "66666666-6666-4666-8666-666666666666";

describe("RouteEtaService", () => {
  it.each([riderId, mechanicId, adminId])("returns provider ETA to authorized actor %s", async (actorId) => {
    const provider = fakeProvider(async () => ({ distanceMeters: 2500, durationSeconds: 480 }));
    const service = createService(fixture(), provider);

    await expect(service.getRouteEta(identity(actorId), assignmentId)).resolves.toMatchObject({
      assignment_id: assignmentId,
      status: "available",
      source: "google_routes",
      distance_meters: 2500,
      duration_seconds: 480,
      calculated_at: now.toISOString(),
      advisory: { code: "TWO_WHEELER_ROUTE_ESTIMATE" }
    });
  });

  it("rejects cross-assignment access and terminal assignments before provider use", async () => {
    const provider = fakeProvider(async () => ({ distanceMeters: 1, durationSeconds: 1 }));
    await expect(
      createService(fixture(), provider).getRouteEta(identity(otherRiderId), assignmentId)
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      createService(fixture({ assignmentStatus: "completed" }), provider)
        .getRouteEta(identity(riderId), assignmentId)
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    expect(provider.compute).not.toHaveBeenCalled();
  });

  it.each([
    ["provider_disabled"],
    ["provider_timeout"],
    ["provider_quota"],
    ["provider_auth"],
    ["provider_error"],
    ["provider_invalid_response"],
    ["no_route"]
  ] as const)("returns distance-only fallback for %s", async (reason) => {
    const provider = fakeProvider(async () => { throw new RouteEtaProviderError(reason); });
    const response = await createService(fixture(), provider).getRouteEta(identity(riderId), assignmentId);
    expect(response).toMatchObject({
      status: "fallback",
      source: "straight_line_fallback",
      unavailable_reason: reason
    });
    expect(response.distance_meters).toBeGreaterThan(0);
    expect(response).not.toHaveProperty("duration_seconds");
  });

  it("returns unavailable before provider use for missing or stale coordinates", async () => {
    const provider = fakeProvider(async () => ({ distanceMeters: 1, durationSeconds: 1 }));
    await expect(
      createService(fixture({ noMechanicLocation: true }), provider)
        .getRouteEta(identity(riderId), assignmentId)
    ).resolves.toMatchObject({ status: "unavailable", source: "none", unavailable_reason: "origin_missing" });
    await expect(
      createService(fixture({ staleMechanicLocation: true }), provider)
        .getRouteEta(identity(riderId), assignmentId)
    ).resolves.toMatchObject({ status: "unavailable", unavailable_reason: "origin_stale" });
    await expect(
      createService(fixture({ noDestination: true }), provider)
        .getRouteEta(identity(riderId), assignmentId)
    ).resolves.toMatchObject({ status: "unavailable", unavailable_reason: "destination_missing" });
    expect(provider.compute).not.toHaveBeenCalled();
  });

  it("deduplicates/cache-reuses equivalent requests and never mutates workflow state", async () => {
    let release!: () => void;
    const provider = fakeProvider(async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return { distanceMeters: 2500, durationSeconds: 480 };
    });
    const unitOfWork = fixture();
    const service = createService(unitOfWork, provider);

    const left = service.getRouteEta(identity(riderId), assignmentId);
    const right = service.getRouteEta(identity(mechanicId), assignmentId);
    await vi.waitFor(() => expect(provider.compute).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([left, right]);
    await service.getRouteEta(identity(adminId), assignmentId);

    expect(provider.compute).toHaveBeenCalledTimes(1);
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.assignments[0]?.status).toBe("en_route");
    expect(snapshot.serviceRequests[0]?.status).toBe("mechanic_en_route");
    expect(snapshot.auditLogs).toHaveLength(0);
    expect(snapshot.outboxEvents).toHaveLength(0);
  });
});

function createService(unitOfWork: InMemoryUnitOfWork, provider: RouteEtaProvider) {
  return new RouteEtaService(
    unitOfWork,
    provider,
    new ExpiringSingleFlightCache({ ttlMs: 60_000, maxEntries: 100, now: () => now.getTime() }),
    { now: () => now, locationMaxAgeSeconds: 300 }
  );
}

function fakeProvider(compute: RouteEtaProvider["compute"]): RouteEtaProvider & { compute: ReturnType<typeof vi.fn> } {
  return { source: "google_routes", compute: vi.fn(compute) };
}

function fixture(options: {
  assignmentStatus?: "en_route" | "completed";
  noMechanicLocation?: boolean;
  staleMechanicLocation?: boolean;
  noDestination?: boolean;
} = {}) {
  return new InMemoryUnitOfWork({
    users: [riderId, mechanicId, otherRiderId, adminId].map((id) => ({
      id, status: "active" as const, createdAt: now, updatedAt: now
    })),
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" },
      { userId: otherRiderId, role: "rider" },
      { userId: adminId, role: "admin" }
    ],
    mechanicProfiles: [{
      userId: mechanicId,
      profileStatus: "active",
      isAvailable: false,
      serviceRadiusKm: 10,
      ...(options.noMechanicLocation ? {} : { latestLocation: { latitude: 10.775, longitude: 106.7 } }),
      ...(options.noMechanicLocation ? {} : {
        locationUpdatedAt: options.staleMechanicLocation
          ? new Date(now.getTime() - 301_000)
          : new Date(now.getTime() - 10_000)
      }),
      availabilityUpdatedAt: now,
      ratingAvg: 0,
      ratingCount: 0,
      serviceTypes: ["mobile_repair"],
      createdAt: now,
      updatedAt: now
    }],
    serviceRequests: [{
      id: requestId,
      requestCode: "COR-MOB-20260823-1",
      riderId,
      motorcycleId: "77777777-7777-4777-8777-777777777777",
      serviceType: "mobile_repair",
      problemDescription: "private",
      status: options.assignmentStatus === "completed" ? "completed" : "mechanic_en_route",
      priority: "normal",
      ...(options.noDestination ? {} : { serviceLocation: { latitude: 10.78, longitude: 106.69 } }),
      createdAt: now,
      updatedAt: now
    }],
    assignments: [{
      id: assignmentId,
      requestId,
      mechanicId,
      acceptedCandidateId: "88888888-8888-4888-8888-888888888888",
      status: options.assignmentStatus ?? "en_route",
      acceptedAt: now,
      createdAt: now,
      updatedAt: now
    }]
  });
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return { subject, issuer: "test", audience: ["authenticated"] };
}
