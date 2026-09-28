import { describe, expect, it } from "vitest";

import { InMemoryOperationalMonitoringRepository } from "@/server/repositories/testing/in-memory-operational-monitoring.repository";
import type { OperationalCursor } from "@/server/repositories/contracts/operational-monitoring.repository";

/**
 * The `payments-needs-review` queue is the only queue that enriches its rows from
 * another table (`service_requests.request_code`). These tests pin the join
 * behaviour so the in-memory adapter cannot silently drift from the Postgres
 * `left join`.
 */

const now = new Date("2026-09-29T03:00:00.000Z");

const linkedRequestId = "11111111-1111-4111-8111-111111111111";
const missingRequestId = "22222222-2222-4222-8222-222222222222";

function createRepository() {
  return new InMemoryOperationalMonitoringRepository({
    outboxEvents: [],
    dispatchRounds: [],
    workerRuns: [],
    serviceRequests: [
      {
        id: linkedRequestId,
        requestCode: "COR-MOB-20260928-0007",
        riderId: "33333333-3333-4333-8333-333333333333",
        motorcycleId: "44444444-4444-4444-8444-444444444444",
        serviceType: "mobile_repair",
        problemDescription: "Xe khong khoi dong.",
        status: "awaiting_payment",
        priority: "normal",
        createdAt: now,
        updatedAt: now
      }
    ],
    paymentOrders: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        quoteId: "66666666-6666-4666-8666-666666666666",
        requestId: linkedRequestId,
        assignmentId: "77777777-7777-4777-8777-777777777777",
        riderId: "33333333-3333-4333-8333-333333333333",
        provider: "payos",
        providerOrderCode: 5001,
        status: "needs_review",
        currency: "VND",
        amount: 150000,
        description: "Thanh toan bao gia",
        createdAt: now,
        updatedAt: now
      },
      {
        // Orphan payment order: the owning request row is gone. The Postgres
        // implementation uses a `left join`, so this row must survive without a
        // `requestCode` instead of disappearing.
        id: "88888888-8888-4888-8888-888888888888",
        quoteId: "99999999-9999-4999-8999-999999999999",
        requestId: missingRequestId,
        assignmentId: "77777777-7777-4777-8777-777777777777",
        riderId: "33333333-3333-4333-8333-333333333333",
        provider: "payos",
        providerOrderCode: 5002,
        status: "needs_review",
        currency: "VND",
        amount: 220000,
        description: "Thanh toan bao gia",
        createdAt: now,
        updatedAt: now
      } as never,
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        quoteId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        requestId: linkedRequestId,
        assignmentId: "77777777-7777-4777-8777-777777777777",
        riderId: "33333333-3333-4333-8333-333333333333",
        provider: "payos",
        providerOrderCode: 5003,
        status: "succeeded",
        currency: "VND",
        amount: 90000,
        description: "Da thanh toan",
        createdAt: now,
        updatedAt: now
      }
    ]
  });
}

describe("operational monitoring needs-review payments", () => {
  it("includes the owning service request code for each payment order", async () => {
    const rows = await createRepository().listNeedsReviewPayments({ limit: 25 });

    const linked = rows.find((r) => r.requestId === linkedRequestId);
    expect(linked?.requestCode).toBe("COR-MOB-20260928-0007");
  });

  it("keeps payment orders whose request row is missing, without a request code", async () => {
    const rows = await createRepository().listNeedsReviewPayments({ limit: 25 });

    const orphan = rows.find((r) => r.requestId === missingRequestId);
    expect(orphan).toBeDefined();
    expect(orphan?.requestCode).toBeUndefined();
  });

  it("only returns payment orders in the needs_review status", async () => {
    const rows = await createRepository().listNeedsReviewPayments({ limit: 25 });

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "needs_review")).toBe(true);
  });

  it("keeps cursor pagination working after the join", async () => {
    const repository = createRepository();

    const first = await repository.listNeedsReviewPayments({ limit: 1 });
    expect(first).toHaveLength(1);

    const cursor: OperationalCursor = { createdAt: first[0].updatedAt, id: first[0].id };
    const second = await repository.listNeedsReviewPayments({ limit: 25, cursor });

    expect(second.map((r) => r.id)).not.toContain(first[0].id);
  });
});
