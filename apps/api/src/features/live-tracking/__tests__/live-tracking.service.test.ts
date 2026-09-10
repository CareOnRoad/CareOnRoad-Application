import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import type { LiveTrackingConfig } from "../live-tracking.schemas";
import { LiveTrackingService } from "../live-tracking.service";

const now = new Date("2026-08-23T07:00:00.000Z");
const riderId = "11111111-1111-4111-8111-111111111111";
const mechanicId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const assignmentId = "66666666-6666-4666-8666-666666666666";

describe("LiveTrackingService", () => {
  it("lets only the assigned mechanic publish a valid latest point", async () => {
    const unitOfWork = fixture();
    const service = createService(unitOfWork);
    const result = await service.publish(identity(mechanicId), assignmentId, validInput());

    expect(result.created).toBe(true);
    expect(result.location).toMatchObject({
      assignment_id: assignmentId,
      observed_at: "2026-08-23T06:59:55.000Z",
      accuracy_meters: 12,
      freshness: "current"
    });
    expect(unitOfWork.snapshot().assignmentLiveLocations).toHaveLength(1);
    expect(unitOfWork.snapshot().auditLogs).toHaveLength(0);
    expect(unitOfWork.snapshot().outboxEvents).toHaveLength(0);

    await expect(createService(fixture()).publish(identity(otherId), assignmentId, validInput()))
      .rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(createService(fixture()).publish(identity(riderId), assignmentId, validInput()))
      .rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
  });

  it("requires enabled explicit retention and eligible travel state", async () => {
    await expect(new LiveTrackingService(fixture(), { ...config, enabled: false }, { now: () => now })
      .publish(identity(mechanicId), assignmentId, validInput()))
      .rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    await expect(createService(fixture("on_site")).publish(identity(mechanicId), assignmentId, validInput()))
      .rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });

  it.each([
    [{ ...validInput(), observed_at: "2026-08-23T06:59:29.000Z" }, "too old"],
    [{ ...validInput(), observed_at: "2026-08-23T07:00:06.000Z" }, "future"],
    [{ ...validInput(), accuracy_meters: 51 }, "accuracy"]
  ])("rejects invalid freshness/accuracy without coordinate details: %s", async (input) => {
    const error = await createService(fixture()).publish(identity(mechanicId), assignmentId, input)
      .catch((caught) => caught);
    expect(error).toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    expect(String(error)).not.toContain(String(input.latitude));
    expect(String(error)).not.toContain(String(input.longitude));
  });

  it("rejects replay and too-frequent updates without replacing latest", async () => {
    const unitOfWork = fixture();
    const first = createService(unitOfWork);
    await first.publish(identity(mechanicId), assignmentId, validInput());
    await expect(first.publish(identity(mechanicId), assignmentId, validInput()))
      .rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });

    const afterThreeSeconds = new LiveTrackingService(unitOfWork, config, {
      now: () => new Date(now.getTime() + 3_000)
    });
    await expect(afterThreeSeconds.publish(identity(mechanicId), assignmentId, {
      ...validInput(), observed_at: "2026-08-23T07:00:01.000Z"
    })).rejects.toMatchObject({ status: 429, errorCode: "RATE_LIMITED" });
    expect(unitOfWork.snapshot().assignmentLiveLocations[0]?.observedAt)
      .toEqual(new Date("2026-08-23T06:59:55.000Z"));
  });

  it("serializes concurrent equal updates into one accepted point", async () => {
    const unitOfWork = fixture();
    const service = createService(unitOfWork);
    const results = await Promise.allSettled([
      service.publish(identity(mechanicId), assignmentId, validInput()),
      service.publish(identity(mechanicId), assignmentId, validInput())
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(unitOfWork.snapshot().assignmentLiveLocations).toHaveLength(1);
  });

  it.each([riderId, mechanicId, adminId])("lets authorized actor %s poll only the current point", async (actorId) => {
    const service = createService(fixture("en_route", true));
    await expect(service.getLatest(identity(actorId), assignmentId)).resolves.toMatchObject({
      assignment_id: assignmentId,
      freshness: "current"
    });
  });

  it("denies unrelated reads and hides expired/absent points", async () => {
    await expect(createService(fixture("en_route", true)).getLatest(identity(otherId), assignmentId))
      .rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(createService(fixture()).getLatest(identity(riderId), assignmentId))
      .rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    await expect(createService(fixture("en_route", true, true)).getLatest(identity(riderId), assignmentId))
      .rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    await expect(new LiveTrackingService(
      fixture("en_route", true),
      { ...config, enabled: false },
      { now: () => now }
    ).getLatest(identity(riderId), assignmentId))
      .rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
  });
});

const config: LiveTrackingConfig = {
  enabled: true,
  retentionMinutes: 15,
  maxLocationAgeSeconds: 30,
  maxFutureSkewSeconds: 5,
  minUpdateIntervalSeconds: 5,
  maxAccuracyMeters: 50
};

function createService(unitOfWork: InMemoryUnitOfWork) {
  return new LiveTrackingService(unitOfWork, config, { now: () => now });
}

function validInput() {
  return {
    latitude: 10.77,
    longitude: 106.7,
    observed_at: "2026-08-23T06:59:55.000Z",
    accuracy_meters: 12
  };
}

function fixture(
  status: "accepted" | "en_route" | "on_site" = "accepted",
  withLocation = false,
  expired = false
) {
  return new InMemoryUnitOfWork({
    users: [riderId, mechanicId, otherId, adminId].map((id) => ({
      id, status: "active" as const, createdAt: now, updatedAt: now
    })),
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" },
      { userId: otherId, role: "mechanic" },
      { userId: adminId, role: "admin" }
    ],
    serviceRequests: [{
      id: requestId,
      requestCode: "COR-MOB-20260823-1",
      riderId,
      motorcycleId: "77777777-7777-4777-8777-777777777777",
      serviceType: "mobile_repair",
      problemDescription: "private",
      status: status === "on_site" ? "in_service" : status === "en_route" ? "mechanic_en_route" : "assigned",
      priority: "normal",
      createdAt: now,
      updatedAt: now
    }],
    assignments: [{
      id: assignmentId,
      requestId,
      mechanicId,
      acceptedCandidateId: "88888888-8888-4888-8888-888888888888",
      status,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now
    }],
    assignmentLiveLocations: withLocation ? [{
      assignmentId,
      mechanicId,
      latitude: 10.77,
      longitude: 106.7,
      observedAt: new Date(now.getTime() - 5_000),
      accuracyMeters: 12,
      receivedAt: new Date(now.getTime() - 4_000),
      expiresAt: expired ? new Date(now.getTime() - 1) : new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now
    }] : []
  });
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return { subject, issuer: "test", audience: ["authenticated"] };
}
