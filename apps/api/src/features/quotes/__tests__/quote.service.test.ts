import { describe, expect, it } from "vitest";

import type { VerifiedSupabaseIdentity } from "@/features/auth/auth.types";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";

import { MAX_QUOTE_AMOUNT, QuoteService } from "../quote.service";
import { MAX_PAYMENT_AMOUNT } from "@/features/payments/payment-amount";

const riderId = "11111111-1111-4111-8111-111111111111";
const otherRiderId = "22222222-2222-4222-8222-222222222222";
const mechanicId = "33333333-3333-4333-8333-333333333333";
const otherMechanicId = "44444444-4444-4444-8444-444444444444";
const adminId = "55555555-5555-4555-8555-555555555555";
const motorcycleId = "66666666-6666-4666-8666-666666666666";
const requestId = "77777777-7777-4777-8777-777777777777";
const assignmentId = "88888888-8888-4888-8888-888888888888";
const diagnosisId = "99999999-9999-4999-8999-999999999999";
const now = new Date("2026-06-25T09:00:00.000Z");

describe("quote service", () => {
  it("rejects zero/unsupported standard totals before superseding an existing pending quote", async () => {
    const uow = createUnitOfWork(); const service = new QuoteService(uow, { now: () => now });
    await service.createQuote(identity(mechanicId), requestId, validQuote());
    const before = uow.snapshot();
    for (const input of [{ ...validQuote(), discount_amount: 50_000 },
      { ...validQuote(), lines: [{ ...validQuote().lines[0]!, unit_amount: MAX_PAYMENT_AMOUNT + 1 }] }]) {
      await expect(service.createQuote(identity(mechanicId), requestId, input)).rejects.toMatchObject({ status: 400 });
      expect(uow.snapshot()).toEqual(before);
    }
    await expect(service.createQuote(identity(mechanicId), requestId, { ...validQuote(), lines: [
      { ...validQuote().lines[0]!, unit_amount: 0 }, { ...validQuote().lines[0]!, unit_amount: MAX_PAYMENT_AMOUNT }
    ] })).resolves.toMatchObject({ total_amount: MAX_PAYMENT_AMOUNT });
  });

  it.each([0, MAX_PAYMENT_AMOUNT + 1])("blocks approval of legacy standard total %s without changing history or money", async (amount) => {
    const base = createUnitOfWork(); const created = await new QuoteService(base).createQuote(identity(mechanicId), requestId, validQuote());
    const state = base.snapshot(); const quote = state.quotes.find((q) => q.id === created.id)!;
    quote.totalAmount = amount; quote.subtotalAmount = amount;
    const legacy = new InMemoryUnitOfWork(state);
    await expect(new QuoteService(legacy).approveQuote(identity(riderId), created.id)).rejects.toMatchObject({ status: 409 });
    expect(legacy.snapshot()).toEqual(state);
    await expect(new QuoteService(legacy).rejectQuote(identity(riderId), created.id)).resolves.toMatchObject({ status: "rejected" });
  });
  it("calculates totals, creates immutable versions, and supersedes only the prior pending quote", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new QuoteService(unitOfWork, { now: () => now });

    const first = await service.createQuote(identity(mechanicId), requestId, {
      assignment_id: assignmentId,
      diagnosis_id: diagnosisId,
      discount_amount: 10_000,
      notes: "Gia uoc tinh cua tho may.",
      lines: [
        {
          line_type: "labor",
          description: "Cong kiem tra",
          quantity: 1,
          unit_amount: 50_000
        },
        {
          line_type: "part",
          description: "Bugi",
          quantity: 2,
          unit_amount: 30_000
        }
      ]
    });
    expect(first).toMatchObject({
      version: 1,
      status: "pending",
      currency: "VND",
      subtotal_amount: 110_000,
      discount_amount: 10_000,
      total_amount: 100_000
    });
    expect(unitOfWork.snapshot().assignments[0]?.status).toBe("quoted");
    expect(unitOfWork.snapshot().serviceRequests[0]?.status).toBe(
      "awaiting_quote_approval"
    );

    const second = await service.createQuote(identity(adminId), requestId, {
      assignment_id: assignmentId,
      diagnosis_id: diagnosisId,
      lines: [
        {
          line_type: "labor",
          description: "Cong thay bugi",
          quantity: 1.5,
          unit_amount: 60_000
        }
      ]
    });
    expect(second).toMatchObject({
      version: 2,
      status: "pending",
      subtotal_amount: 90_000,
      total_amount: 90_000
    });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.quotes).toHaveLength(2);
    expect(snapshot.quotes.find((quote) => quote.version === 1)?.status).toBe(
      "superseded"
    );
    expect(snapshot.quoteLines).toHaveLength(3);
    expect(JSON.stringify({ audit: snapshot.auditLogs, outbox: snapshot.outboxEvents }))
      .not.toContain("Cong thay bugi");
    expect(JSON.stringify(snapshot.outboxEvents)).not.toContain("90000");
  });

  it("allows only the owning rider to decide the latest pending version", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new QuoteService(unitOfWork, { now: () => now });
    const first = await service.createQuote(identity(mechanicId), requestId, validQuote());
    const second = await service.createQuote(identity(mechanicId), requestId, validQuote());

    await expect(service.approveQuote(identity(riderId), first.id)).rejects.toMatchObject({
      status: 409,
      errorCode: "CONFLICT"
    });
    await expect(service.approveQuote(identity(otherRiderId), second.id)).rejects.toMatchObject({
      status: 403,
      errorCode: "FORBIDDEN"
    });
    await expect(service.approveQuote(identity(mechanicId), second.id)).rejects.toMatchObject({
      status: 403,
      errorCode: "FORBIDDEN"
    });

    const approved = await service.approveQuote(identity(riderId), second.id);
    expect(approved.status).toBe("approved");
    expect(unitOfWork.snapshot().assignments[0]?.status).toBe("awaiting_payment");
    expect(unitOfWork.snapshot().serviceRequests[0]?.status).toBe("awaiting_payment");
    await expect(service.rejectQuote(identity(riderId), second.id)).rejects.toMatchObject({
      status: 409,
      errorCode: "CONFLICT"
    });
  });

  it("keeps assignment/request quoted after rejection so a new version is required", async () => {
    const unitOfWork = createUnitOfWork();
    const service = new QuoteService(unitOfWork, { now: () => now });
    const quote = await service.createQuote(identity(mechanicId), requestId, validQuote());

    const rejected = await service.rejectQuote(identity(riderId), quote.id);
    expect(rejected.status).toBe("rejected");
    expect(unitOfWork.snapshot().assignments[0]?.status).toBe("quoted");
    expect(unitOfWork.snapshot().serviceRequests[0]?.status).toBe(
      "awaiting_quote_approval"
    );

    const replacement = await service.createQuote(
      identity(mechanicId),
      requestId,
      validQuote()
    );
    expect(replacement.version).toBe(2);
    expect(unitOfWork.snapshot().quotes.find((item) => item.id === quote.id)?.status).toBe(
      "rejected"
    );
  });

  it("rejects invalid values, overflow, mismatched assignment/diagnosis, and unauthorized actors", async () => {
    const service = new QuoteService(createUnitOfWork(), { now: () => now });

    await expect(
      service.createQuote(identity(otherMechanicId), requestId, validQuote())
    ).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    await expect(
      service.createQuote(identity(mechanicId), requestId, {
        ...validQuote(),
        lines: [{ ...validQuote().lines[0], unit_amount: -1 }]
      })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createQuote(identity(mechanicId), requestId, {
        ...validQuote(),
        lines: [
          {
            ...validQuote().lines[0],
            quantity: 100,
            unit_amount: MAX_QUOTE_AMOUNT
          }
        ]
      })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.createQuote(identity(mechanicId), requestId, {
        ...validQuote(),
        diagnosis_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      })
    ).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
  });
});

function createUnitOfWork() {
  return new InMemoryUnitOfWork({
    users: [
      activeUser(riderId),
      activeUser(otherRiderId),
      activeUser(mechanicId),
      activeUser(otherMechanicId),
      activeUser(adminId)
    ],
    userRoles: [
      { userId: riderId, role: "rider" },
      { userId: otherRiderId, role: "rider" },
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
        acceptedCandidateId: "aaaaaaaa-0000-4000-8000-000000000001",
        status: "diagnosis",
        acceptedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ],
    mechanicDiagnoses: [
      {
        id: diagnosisId,
        assignmentId,
        requestId,
        mechanicId,
        diagnosisText: "Bugi mon.",
        createdAt: now,
        updatedAt: now
      }
    ]
  });
}

function validQuote() {
  return {
    assignment_id: assignmentId,
    diagnosis_id: diagnosisId,
    discount_amount: 0,
    lines: [
      {
        line_type: "labor",
        description: "Cong kiem tra",
        quantity: 1,
        unit_amount: 50_000
      }
    ]
  };
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
