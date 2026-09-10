import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { AssignmentRecoveryService } from "../assignment-recovery.service";

const now = new Date("2026-08-23T03:00:00.000Z");
const riderId = "11111111-1111-4111-8111-111111111111";
const mechanicId = "22222222-2222-4222-8222-222222222222";
const otherMechanicId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const requestId = "55555555-5555-4555-8555-555555555555";
const assignmentId = "66666666-6666-4666-8666-666666666666";

describe("assignment recovery service", () => {
  it("recovers mechanic-owned work once and replays the completed response", async () => {
    const unitOfWork = fixture();
    const service = new AssignmentRecoveryService(unitOfWork, { now: () => now });

    const first = await service.recover(
      identity(mechanicId),
      assignmentId,
      { reason_code: "cannot_continue" },
      "recover-key-001"
    );
    const replay = await service.recover(
      identity(mechanicId),
      assignmentId,
      { reason_code: "cannot_continue" },
      "recover-key-001"
    );

    expect(replay).toEqual(first);
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.assignments[0]).toMatchObject({
      status: "recovery_canceled",
      canceledAt: now
    });
    expect(snapshot.serviceRequests[0]?.status).toBe("submitted");
    expect(snapshot.assignmentStatusHistory).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.outboxEvents[0]).toMatchObject({
      topic: "assignment.recovery.requested",
      payload: { reason_code: "cannot_continue", request_id: requestId }
    });
    expect(JSON.stringify(snapshot.auditLogs)).not.toContain("private problem text");
  });

  it("enforces mechanic ownership, admin-only reasons, and eligible lifecycle", async () => {
    await expect(
      new AssignmentRecoveryService(fixture()).recover(
        identity(otherMechanicId), assignmentId, { reason_code: "cannot_continue" }, "recover-key-002"
      )
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      new AssignmentRecoveryService(fixture()).recover(
        identity(mechanicId), assignmentId, { reason_code: "no_show" }, "recover-key-003"
      )
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });

    const adminUnit = fixture();
    await expect(
      new AssignmentRecoveryService(adminUnit, { now: () => now }).recover(
        identity(adminId), assignmentId, { reason_code: "lost_contact" }, "recover-key-004"
      )
    ).resolves.toMatchObject({ status: "recovery_canceled", reason_code: "lost_contact" });

    const lateUnit = fixture("on_site", "in_service");
    await expect(
      new AssignmentRecoveryService(lateUnit).recover(
        identity(adminId), assignmentId, { reason_code: "lost_contact" }, "recover-key-005"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });

  it("serializes concurrent commands into one recovery", async () => {
    const unitOfWork = fixture();
    const service = new AssignmentRecoveryService(unitOfWork, { now: () => now });
    const results = await Promise.allSettled([
      service.recover(identity(adminId), assignmentId, { reason_code: "no_show" }, "recover-key-006"),
      service.recover(identity(adminId), assignmentId, { reason_code: "no_show" }, "recover-key-007")
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(unitOfWork.snapshot().outboxEvents).toHaveLength(1);
  });
});

function fixture(
  status: "accepted" | "on_site" = "accepted",
  requestStatus: "assigned" | "in_service" = "assigned"
) {
  return new InMemoryUnitOfWork({
    users: [riderId, mechanicId, otherMechanicId, adminId].map((id) => ({
      id, status: "active" as const, createdAt: now, updatedAt: now
    })),
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" },
      { userId: otherMechanicId, role: "mechanic" },
      { userId: adminId, role: "admin" }
    ],
    serviceRequests: [{
      id: requestId,
      requestCode: "COR-MOB-20260823-1",
      riderId,
      motorcycleId: "77777777-7777-4777-8777-777777777777",
      serviceType: "mobile_repair",
      problemDescription: "private problem text",
      status: requestStatus,
      priority: "normal",
      serviceLocation: { latitude: 10.76, longitude: 106.66 },
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
    }]
  });
}

function identity(subject: string): VerifiedSupabaseIdentity {
  return { subject, issuer: "https://example.supabase.co/auth/v1", audience: ["authenticated"] };
}
