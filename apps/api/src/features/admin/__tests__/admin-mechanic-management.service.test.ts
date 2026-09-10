import { describe, expect, it } from "vitest";

import type { InMemoryFoundationState } from "@/server/repositories/testing/in-memory-unit-of-work";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AdminMechanicManagementService } from "../admin-mechanic-management.service";
import { adminIdentity, ADMIN_USER_ID } from "./admin-route-test-helpers";

const PENDING_ID = "22222222-2222-4222-8222-222222222222";
const ACTIVE_ID = "33333333-3333-4333-8333-333333333333";
const REJECT_ID = "44444444-4444-4444-8444-444444444444";
const ASSIGNMENT_ID = "55555555-5555-4555-8555-555555555555";
const REQUEST_ID = "66666666-6666-4666-8666-666666666666";
const CANDIDATE_ID = "77777777-7777-4777-8777-777777777777";
const now = new Date("2026-07-06T03:00:00.000Z");
const reason = { reason: "Approved mechanic administration change" };

describe("AdminMechanicManagementService", () => {
  it("lists and filters bounded admin-safe summaries and details", async () => {
    const service = createService(createState());
    const page = await service.listMechanics(adminIdentity, {
      limit: "2",
      profile_status: "active",
      service_type: "mobile_repair",
      is_available: "true",
      location_freshness: "fresh",
      work_state: "idle"
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      user_id: ACTIVE_ID,
      location_freshness: "fresh",
      work_state: "idle",
      rating_avg: 4.75,
      rating_count: 20
    });
    expect(JSON.stringify(page)).not.toMatch(/latitude|longitude|latest_location/);

    const detail = await service.getMechanic(adminIdentity, ACTIVE_ID);
    expect(detail).toMatchObject({ user_id: ACTIVE_ID, rating_avg: 4.75 });
    expect(detail).not.toHaveProperty("trusted_rating");
  });

  it("approves and rejects pending mechanics with replay-safe audit/outbox", async () => {
    const unitOfWork = createState();
    const service = createService(unitOfWork);
    const approved = await service.approve(
      adminIdentity,
      PENDING_ID,
      reason,
      "approve-mechanic-key"
    );
    const replay = await service.approve(
      adminIdentity,
      PENDING_ID,
      reason,
      "approve-mechanic-key"
    );
    expect(approved.profile_status).toBe("active");
    expect(replay).toEqual(approved);
    await expect(
      service.reject(adminIdentity, REJECT_ID, reason, "reject-mechanic-key")
    ).resolves.toMatchObject({ profile_status: "rejected" });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.auditLogs).toHaveLength(2);
    expect(snapshot.outboxEvents).toHaveLength(2);
    expect(snapshot.auditLogs.every((log) => log.adminReason === reason.reason)).toBe(
      true
    );
  });

  it("suspends, reactivates, bans, and never generically reactivates a ban", async () => {
    const service = createService(createState());
    await expect(
      service.suspend(adminIdentity, ACTIVE_ID, reason, "suspend-mechanic-key")
    ).resolves.toMatchObject({ profile_status: "suspended" });
    await expect(
      service.reactivate(
        adminIdentity,
        ACTIVE_ID,
        reason,
        "reactivate-mechanic-key"
      )
    ).resolves.toMatchObject({ profile_status: "active" });
    await expect(
      service.ban(adminIdentity, ACTIVE_ID, reason, "ban-mechanic-key")
    ).resolves.toMatchObject({ profile_status: "banned" });
    await expect(
      service.reactivate(
        adminIdentity,
        ACTIVE_ID,
        reason,
        "reactivate-banned-key"
      )
    ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });
  });

  it("guards active assignments while force-unavailable preserves assignment history", async () => {
    const unitOfWork = createState({ activeAssignment: true });
    const service = createService(unitOfWork);
    await expect(
      service.suspend(adminIdentity, ACTIVE_ID, reason, "guarded-suspend-key")
    ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });
    await expect(
      service.ban(adminIdentity, ACTIVE_ID, reason, "guarded-ban-key")
    ).rejects.toMatchObject({ errorCode: "CONFLICT", status: 409 });

    await expect(
      service.forceUnavailable(
        adminIdentity,
        ACTIVE_ID,
        reason,
        "force-unavailable-key"
      )
    ).resolves.toMatchObject({ is_available: false, work_state: "active_assignment" });
    expect(unitOfWork.snapshot().assignments).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ASSIGNMENT_ID, status: "accepted" })])
    );
    expect(unitOfWork.snapshot().assignmentStatusHistory).toHaveLength(0);
  });

  it("atomically replaces skills/radius and exposes trusted read-only performance", async () => {
    const unitOfWork = createState({ completedAssignment: true });
    const service = createService(unitOfWork);
    await service.updateSkills(
      adminIdentity,
      ACTIVE_ID,
      {
        reason: reason.reason,
        service_types: ["emergency_rescue", "periodic_maintenance"]
      },
      "replace-skills-key"
    );
    await service.updateRadius(
      adminIdentity,
      ACTIVE_ID,
      { reason: reason.reason, service_radius_km: 42 },
      "replace-radius-key"
    );
    const detail = await service.getMechanic(adminIdentity, ACTIVE_ID);
    expect(detail).toMatchObject({
      service_types: ["emergency_rescue", "periodic_maintenance"],
      service_radius_km: 42,
      rating_avg: 4.75,
      rating_count: 20
    });
    const performance = await service.getPerformance(adminIdentity, ACTIVE_ID);
    expect(performance).toEqual({
      mechanic_id: ACTIVE_ID,
      assignments: { total: 1, active: 0, completed: 1, canceled: 0 },
      trusted_rating: { average: 4.75, count: 20 }
    });
    const history = await service.listWorkHistory(adminIdentity, ACTIVE_ID, {
      limit: "10"
    });
    expect(history.items).toEqual([
      expect.objectContaining({ assignment_id: ASSIGNMENT_ID, status: "completed" })
    ]);
  });

  it("rolls back profile and idempotency when outbox append fails", async () => {
    const occurrenceId = "99999999-9999-4999-8999-999999999999";
    const unitOfWork = createState({
      outboxEvents: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          topic: "admin.mechanic.suspended",
          aggregateType: "mechanic_profile",
          aggregateId: ACTIVE_ID,
          dedupeKey: `admin.mechanic.suspended:${ACTIVE_ID}:${occurrenceId}`,
          payload: {},
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: now,
          createdAt: now
        }
      ]
    });
    const identifiers = [
      "88888888-8888-4888-8888-888888888888",
      occurrenceId,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    ];
    const service = new AdminMechanicManagementService(unitOfWork, {
      now: () => now,
      createId: () => identifiers.shift()!
    });
    await expect(
      service.suspend(adminIdentity, ACTIVE_ID, reason, "rollback-mechanic-key")
    ).rejects.toThrow("OUTBOX_DEDUPE_KEY_EXISTS");
    const snapshot = unitOfWork.snapshot();
    expect(
      snapshot.mechanicProfiles.find((profile) => profile.userId === ACTIVE_ID)
        ?.profileStatus
    ).toBe("active");
    expect(snapshot.idempotencyRecords).toHaveLength(0);
    expect(snapshot.auditLogs).toHaveLength(0);
  });
});

function createService(unitOfWork: InMemoryUnitOfWork) {
  return new AdminMechanicManagementService(unitOfWork, { now: () => now });
}

function createState(
  options: {
    activeAssignment?: boolean;
    completedAssignment?: boolean;
    outboxEvents?: InMemoryFoundationState["outboxEvents"];
  } = {}
) {
  const assignmentStatus = options.completedAssignment
    ? ("completed" as const)
    : ("accepted" as const);
  const assignments =
    options.activeAssignment || options.completedAssignment
      ? [
          {
            id: ASSIGNMENT_ID,
            requestId: REQUEST_ID,
            mechanicId: ACTIVE_ID,
            acceptedCandidateId: CANDIDATE_ID,
            status: assignmentStatus,
            acceptedAt: new Date("2026-07-05T00:00:00Z"),
            ...(options.completedAssignment
              ? { completedAt: new Date("2026-07-05T02:00:00Z") }
              : {}),
            createdAt: new Date("2026-07-05T00:00:00Z"),
            updatedAt: new Date("2026-07-05T02:00:00Z")
          }
        ]
      : [];
  return new InMemoryUnitOfWork({
    users: [
      appUser(ADMIN_USER_ID),
      appUser(PENDING_ID),
      appUser(ACTIVE_ID),
      appUser(REJECT_ID)
    ],
    userRoles: [
      { userId: ADMIN_USER_ID, role: "admin" },
      { userId: PENDING_ID, role: "mechanic" },
      { userId: ACTIVE_ID, role: "mechanic" },
      { userId: REJECT_ID, role: "mechanic" }
    ],
    mechanicProfiles: [
      profile(PENDING_ID, "pending", false, undefined, 0, 0),
      profile(
        ACTIVE_ID,
        "active",
        true,
        new Date("2026-07-06T02:58:00Z"),
        4.75,
        20
      ),
      profile(REJECT_ID, "pending", false, undefined, 0, 0)
    ],
    assignments,
    outboxEvents: options.outboxEvents ?? []
  });
}

function appUser(id: string) {
  return {
    id,
    status: "active" as const,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z")
  };
}

function profile(
  userId: string,
  profileStatus: "pending" | "active",
  isAvailable: boolean,
  locationUpdatedAt: Date | undefined,
  ratingAvg: number,
  ratingCount: number
) {
  return {
    userId,
    profileStatus,
    isAvailable,
    serviceRadiusKm: 10,
    latestLocation: locationUpdatedAt
      ? { latitude: 10.75, longitude: 106.67 }
      : undefined,
    locationUpdatedAt,
    availabilityUpdatedAt: new Date("2026-07-05T00:00:00Z"),
    ratingAvg,
    ratingCount,
    serviceTypes: ["mobile_repair" as const],
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date(`2026-07-0${userId === ACTIVE_ID ? "5" : "4"}T00:00:00Z`)
  };
}
