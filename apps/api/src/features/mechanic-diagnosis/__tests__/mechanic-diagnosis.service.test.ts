import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import type { AssignmentStatus } from "@/server/repositories/contracts/assignment.repository";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { MechanicDiagnosisService } from "../mechanic-diagnosis.service";

const riderId = "11111111-1111-4111-8111-111111111111";
const mechanicId = "22222222-2222-4222-8222-222222222222";
const otherMechanicId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const motorcycleId = "55555555-5555-4555-8555-555555555555";
const requestId = "66666666-6666-4666-8666-666666666666";
const assignmentId = "77777777-7777-4777-8777-777777777777";
const offerId = "88888888-8888-4888-8888-888888888888";
const diagnosisId = "99999999-9999-4999-8999-999999999999";
const now = new Date("2026-06-25T08:00:00.000Z");

describe("mechanic diagnosis service", () => {
  it("creates and revises one current text-first diagnosis for the assigned mechanic or admin", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new MechanicDiagnosisService(unitOfWork, {
      now: () => now,
      createId: sequentialIds([
        diagnosisId,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
      ])
    });

    const created = await service.upsertDiagnosis(identity(mechanicId), assignmentId, {
      diagnosis_text: "Bugi bam muoi va can ve sinh.",
      recommended_work_text: "Ve sinh bugi va kiem tra khe ho.",
      safety_notes: "Khong phai ket luan tu AI."
    });
    expect(created).toMatchObject({
      id: diagnosisId,
      assignment_id: assignmentId,
      request_id: requestId,
      mechanic_id: mechanicId,
      diagnosis_text: "Bugi bam muoi va can ve sinh."
    });

    const revised = await service.upsertDiagnosis(identity(adminId), assignmentId, {
      diagnosis_text: "Bugi mon, can thay the.",
      recommended_work_text: "Thay bugi dung thong so."
    });
    expect(revised.id).toBe(diagnosisId);
    expect(unitOfWork.snapshot().mechanicDiagnoses).toHaveLength(1);
    expect(unitOfWork.snapshot().mechanicDiagnoses[0]?.diagnosisText).toBe(
      "Bugi mon, can thay the."
    );
    expect(unitOfWork.snapshot().assignments[0]?.status).toBe("on_site");
    expect(unitOfWork.snapshot().serviceRequests[0]?.status).toBe("in_service");

    const serializedEvents = JSON.stringify({
      audit: unitOfWork.snapshot().auditLogs,
      outbox: unitOfWork.snapshot().outboxEvents
    });
    expect(serializedEvents).not.toContain("Bugi bam muoi");
    expect(serializedEvents).not.toContain("Bugi mon");
    expect(unitOfWork.snapshot().auditLogs).toHaveLength(2);
    expect(unitOfWork.snapshot().outboxEvents).toHaveLength(2);
  });

  it("enforces actor, assignment state, and post-quote immutability", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new MechanicDiagnosisService(unitOfWork, { now: () => now });

    await expect(
      service.upsertDiagnosis(identity(otherMechanicId), assignmentId, {
        diagnosis_text: "Khong duoc phep."
      })
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      service.upsertDiagnosis(identity(riderId), assignmentId, {
        diagnosis_text: "Rider khong duoc tao."
      })
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });

    const invalidState = createUnitOfWork({ assignmentStatus: "accepted" });
    await expect(
      new MechanicDiagnosisService(invalidState).upsertDiagnosis(
        identity(mechanicId),
        assignmentId,
        { diagnosis_text: "Trang thai chua cho phep." }
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });

    const quoted = createUnitOfWork({ withDiagnosis: true, withQuote: true });
    await expect(
      new MechanicDiagnosisService(quoted).upsertDiagnosis(
        identity(mechanicId),
        assignmentId,
        { diagnosis_text: "Khong duoc sua sau bao gia." }
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });

  it("serializes concurrent revisions and re-checks the current diagnosis", async () => {
    const unitOfWork = createUnitOfWork({
      assignmentStatus: "diagnosis",
      withDiagnosis: true
    });
    const service = new MechanicDiagnosisService(unitOfWork, { now: () => now });

    const results = await Promise.all([
      service.upsertDiagnosis(identity(mechanicId), assignmentId, {
        diagnosis_text: "Revision A"
      }),
      service.upsertDiagnosis(identity(adminId), assignmentId, {
        diagnosis_text: "Revision B"
      })
    ]);

    expect(results).toHaveLength(2);
    expect(unitOfWork.snapshot().mechanicDiagnoses).toHaveLength(1);
    expect(["Revision A", "Revision B"]).toContain(
      unitOfWork.snapshot().mechanicDiagnoses[0]?.diagnosisText
    );
    expect(unitOfWork.snapshot().auditLogs).toHaveLength(2);
    expect(unitOfWork.snapshot().outboxEvents).toHaveLength(2);
  });
});

function createUnitOfWork(
  options: {
    assignmentStatus?: AssignmentStatus;
    withDiagnosis?: boolean;
    withQuote?: boolean;
  } = {}
) {
  const assignmentStatus = options.assignmentStatus ?? "on_site";
  return new InMemoryUnitOfWork({
    users: [
      activeUser(riderId),
      activeUser(mechanicId),
      activeUser(otherMechanicId),
      activeUser(adminId)
    ],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: mechanicId, role: "mechanic" },
      { userId: otherMechanicId, role: "mechanic" },
      { userId: adminId, role: "admin" }
    ],
    motorcycles: [
      {
        id: motorcycleId,
        riderId,
        brandText: "Honda",
        modelText: "Wave",
        createdAt: now,
        updatedAt: now
      }
    ],
    serviceRequests: [
      {
        id: requestId,
        requestCode: "COR-MOB-20260625-1",
        riderId,
        motorcycleId,
        serviceType: "mobile_repair",
        problemDescription: "Xe kho no.",
        status: "in_service",
        priority: "normal",
        createdAt: now,
        updatedAt: now
      }
    ],
    assignments: [
      {
        id: assignmentId,
        requestId,
        mechanicId,
        acceptedCandidateId: offerId,
        status: assignmentStatus,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ],
    mechanicDiagnoses: options.withDiagnosis
      ? [
          {
            id: diagnosisId,
            assignmentId,
            requestId,
            mechanicId,
            diagnosisText: "Chan doan ban dau.",
            createdAt: now,
            updatedAt: now
          }
        ]
      : [],
    quotes: options.withQuote
      ? [
          {
            id: "aaaaaaaa-0000-4000-8000-000000000001",
            requestId,
            assignmentId,
            diagnosisId,
            version: 1,
            status: "pending",
            currency: "VND",
            subtotalAmount: 100_000,
            discountAmount: 0,
            totalAmount: 100_000,
            lines: [],
            createdBy: mechanicId,
            createdAt: now
          }
        ]
      : []
  });
}

function activeUser(id: string) {
  return { id, status: "active" as const, createdAt: now, updatedAt: now };
}

function identity(subject: string): VerifiedSupabaseIdentity {
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
