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
    const before = unitOfWork.snapshot();

    await expect(
      unitOfWork.execute(async ({ adminConfiguration, adminInternalNotes, audit, idempotency, outbox }) => {
        await adminConfiguration.update({
          id: "configuration-rollback",
          key: "dispatch.max_rounds",
          value: 8,
          actorId: "actor-1",
          reason: "Verify transactional configuration rollback",
          now: new Date("2026-10-02T00:00:00Z")
        });
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

    expect(unitOfWork.snapshot()).toEqual(before);
  });
});
