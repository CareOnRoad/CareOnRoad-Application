import { describe, expect, it } from "vitest";

import { InMemoryUnitOfWork } from "../testing/in-memory-unit-of-work";

describe("unit of work contract", () => {
  it("commits idempotency, outbox, and audit records together", async () => {
    const unitOfWork = new InMemoryUnitOfWork();

    await unitOfWork.execute(async ({ audit, idempotency, outbox }) => {
      await idempotency.create({
        id: "idem-1",
        actorId: "actor-1",
        scope: "test.create",
        idempotencyKey: "key-1",
        requestHash: "hash-1",
        expiresAt: new Date("2026-06-26T00:00:00.000Z")
      });
      await outbox.append({
        id: "event-1",
        topic: "test.created",
        aggregateType: "test",
        aggregateId: "aggregate-1",
        dedupeKey: "test:aggregate-1",
        payload: { safe_id: "aggregate-1" }
      });
      await audit.append({
        id: "audit-1",
        actorId: "actor-1",
        actorRole: "rider",
        action: "test.created",
        entityType: "test",
        entityId: "aggregate-1",
        requestId: "request-1",
        metadata: { status: "created" }
      });
    });

    expect(unitOfWork.snapshot()).toMatchObject({
      idempotencyRecords: [{ id: "idem-1" }],
      outboxEvents: [{ id: "event-1" }],
      auditLogs: [{ id: "audit-1" }]
    });
  });

  it("rolls back every repository when work fails", async () => {
    const unitOfWork = new InMemoryUnitOfWork();

    await expect(
      unitOfWork.execute(async ({ adminInternalNotes, audit, idempotency, outbox }) => {
        await adminInternalNotes.create({
          id: "note-rollback",
          adminId: "actor-1",
          serviceRequestId: "aggregate-rollback",
          noteText: "Rollback this internal note."
        });
        await idempotency.create({
          id: "idem-rollback",
          actorId: "actor-1",
          scope: "test.create",
          idempotencyKey: "key-rollback",
          requestHash: "hash-rollback",
          expiresAt: new Date("2026-06-26T00:00:00.000Z")
        });
        await outbox.append({
          id: "event-rollback",
          topic: "test.created",
          aggregateType: "test",
          aggregateId: "aggregate-rollback",
          dedupeKey: "test:aggregate-rollback",
          payload: {}
        });
        await audit.append({
          id: "audit-rollback",
          actorId: "actor-1",
          actorRole: "rider",
          action: "test.created",
          entityType: "test",
          entityId: "aggregate-rollback",
          metadata: {}
        });

        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");

    expect(unitOfWork.snapshot()).toEqual({
      adminInternalNotes: [],
      users: [],
      userRoles: [],
      userDevices: [],
      deviceDeliveryCredentials: [],
      idempotencyRecords: [],
      outboxEvents: [],
      workerRuns: [],
      auditLogs: [],
      motorcycles: [],
      mechanicProfiles: [],
      mediaUploadIntents: [],
      assignmentLiveLocations: [],
      serviceRequests: [],
      requestMediaMetadata: [],
      requestStatusHistory: [],
      dailyRequestSequences: [],
      dispatchRounds: [],
      dispatchCandidates: [],
      assignments: [],
      assignmentStatusHistory: [],
      assignmentEtaMetadata: [],
      assignmentMediaMetadata: [],
      assignmentCompletionChecklists: [],
      mechanicDiagnoses: [],
      quotes: [],
      quoteLines: [],
      reminderRules: [],
      reminderOccurrences: [],
      serviceReviews: [],
      notifications: [],
      notificationDeliveryReceipts: [],
      paymentOrders: [],
      paymentEvents: [],
      chatbotSessions: []
    });
  });
});
