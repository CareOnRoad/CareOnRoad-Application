import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import {
  isMechanicLocationFresh,
  LOCATION_MAX_AGE_SECONDS,
  MechanicProfileService
} from "../mechanic-profile.service";

const mechanicId = "11111111-1111-4111-8111-111111111111";
const riderId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-06-25T04:00:00Z");
const mechanicIdentity = identity(mechanicId);
const riderIdentity = identity(riderId);

describe("MechanicProfileService", () => {
  it("reads backend-owned defaults and updates editable settings with atomic audit/outbox", async () => {
    const unitOfWork = seededMechanicUnitOfWork();
    const service = new MechanicProfileService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444"
      ])
    });

    await expect(service.getMyProfile(mechanicIdentity)).resolves.toMatchObject({
      user_id: mechanicId,
      profile_status: "pending",
      is_available: false,
      service_radius_km: 5,
      rating_avg: 0,
      rating_count: 0,
      service_types: ["mobile_repair"]
    });
    await expect(
      service.updateMyProfile(mechanicIdentity, {
        service_radius_km: 12,
        service_types: ["emergency_rescue", "mobile_repair"]
      })
    ).resolves.toMatchObject({
      service_radius_km: 12,
      service_types: ["emergency_rescue", "mobile_repair"],
      rating_avg: 0,
      rating_count: 0
    });

    const snapshot = unitOfWork.snapshot();
    expect(snapshot.mechanicProfiles[0]).toMatchObject({
      profileStatus: "pending",
      ratingAvg: 0,
      ratingCount: 0
    });
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.auditLogs).toHaveLength(1);
  });

  it("rejects mechanic-supplied backend-owned profile and rating fields", async () => {
    const service = new MechanicProfileService(seededMechanicUnitOfWork());

    for (const prohibited of [
      { profile_status: "active" },
      { rating_avg: 5 },
      { rating_count: 10 },
      { location_updated_at: now.toISOString() },
      { availability_updated_at: now.toISOString() }
    ]) {
      await expect(service.updateMyProfile(mechanicIdentity, prohibited)).rejects.toMatchObject({
        status: 400,
        errorCode: "INVALID_INPUT"
      });
    }
  });

  it("maps the admin-owned rejected status without adding a self-service setter", async () => {
    const unitOfWork = seededMechanicUnitOfWork();
    const rejected = new InMemoryUnitOfWork({
      users: [activeUser(mechanicId)],
      userRoles: [{ userId: mechanicId, role: "mechanic" }],
      mechanicProfiles: [
        {
          ...unitOfWork.snapshot().mechanicProfiles[0]!,
          profileStatus: "rejected"
        }
      ]
    });
    const service = new MechanicProfileService(rejected);

    await expect(service.getMyProfile(mechanicIdentity)).resolves.toMatchObject({
      profile_status: "rejected"
    });
    await expect(
      service.updateMyProfile(mechanicIdentity, { profile_status: "active" })
    ).rejects.toMatchObject({ errorCode: "INVALID_INPUT", status: 400 });
  });

  it("updates merged availability and backend-controlled location timestamps", async () => {
    const unitOfWork = seededMechanicUnitOfWork();
    const service = new MechanicProfileService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        "66666666-6666-4666-8666-666666666666"
      ])
    });

    await expect(
      service.updateAvailability(mechanicIdentity, { is_available: true })
    ).resolves.toMatchObject({
      is_available: true,
      availability_updated_at: now.toISOString()
    });
    await service.updateLocation(mechanicIdentity, {
      latitude: 10.762622,
      longitude: 106.660172
    });

    const profile = unitOfWork.snapshot().mechanicProfiles[0]!;
    expect(profile.latestLocation).toEqual({ latitude: 10.762622, longitude: 106.660172 });
    expect(profile.locationUpdatedAt).toEqual(now);
    expect(profile).not.toHaveProperty("activeWorkload");
    expect(JSON.stringify(unitOfWork.snapshot().outboxEvents)).not.toContain("106.660172");
  });

  it("enforces mechanic role, absent profile, and 300-second location freshness boundary", async () => {
    const unitOfWork = seededMechanicUnitOfWork({ includeProfile: false });
    const service = new MechanicProfileService(unitOfWork);

    await expect(service.getMyProfile(mechanicIdentity)).rejects.toMatchObject({
      status: 404,
      errorCode: "NOT_FOUND"
    });
    await expect(service.getMyProfile(riderIdentity)).rejects.toMatchObject({
      status: 403,
      errorCode: "FORBIDDEN"
    });

    expect(LOCATION_MAX_AGE_SECONDS).toBe(300);
    expect(
      isMechanicLocationFresh(new Date(now.getTime() - 300_000), now)
    ).toBe(true);
    expect(
      isMechanicLocationFresh(new Date(now.getTime() - 300_001), now)
    ).toBe(false);
    expect(isMechanicLocationFresh(undefined, now)).toBe(false);
  });
});

function seededMechanicUnitOfWork(options: { includeProfile?: boolean } = {}) {
  const includeProfile = options.includeProfile ?? true;
  return new InMemoryUnitOfWork({
    users: [activeUser(mechanicId), activeUser(riderId)],
    userRoles: [
      { userId: mechanicId, role: "mechanic" },
      { userId: riderId, role: "rider" }
    ],
    mechanicProfiles: includeProfile
      ? [
          {
            userId: mechanicId,
            profileStatus: "pending",
            isAvailable: false,
            serviceRadiusKm: 5,
            availabilityUpdatedAt: new Date("2026-06-25T00:00:00Z"),
            ratingAvg: 0,
            ratingCount: 0,
            serviceTypes: ["mobile_repair"],
            createdAt: new Date("2026-06-25T00:00:00Z"),
            updatedAt: new Date("2026-06-25T00:00:00Z")
          }
        ]
      : []
  });
}

function activeUser(id: string) {
  return {
    id,
    status: "active" as const,
    createdAt: now,
    updatedAt: now
  };
}

function identity(subject: string) {
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
