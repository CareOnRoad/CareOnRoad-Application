import { describe, expect, it } from "vitest";

import { MechanicAssignmentMetadataService } from "../mechanic-assignment-metadata.service";
import {
  ASSIGNMENT_ID,
  COMPLETED_ASSIGNMENT_ID,
  MECHANIC_ID,
  NOW,
  OTHER_ASSIGNMENT_ID,
  identity,
  createMechanicOperationsUnitOfWork
} from "./mechanic-operations-test-fixtures";

describe("MechanicAssignmentMetadataService ETA updates", () => {
  it("stores ETA metadata for the assigned active mechanic with audit and outbox", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const service = new MechanicAssignmentMetadataService(unitOfWork, { now: () => NOW });
    const etaAt = new Date(NOW.getTime() + 10 * 60_000).toISOString();

    const response = await service.updateEta(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      { eta_at: etaAt, delay_reason: "Traffic delay near the rider location." },
      "eta-key-1"
    );

    expect(response).toMatchObject({
      assignment_id: ASSIGNMENT_ID,
      mechanic_id: MECHANIC_ID,
      eta_at: etaAt,
      delay_reason: "Traffic delay near the rider location.",
      created_at: NOW.toISOString()
    });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.assignmentEtaMetadata).toHaveLength(1);
    expect(snapshot.assignments.find((assignment) => assignment.id === ASSIGNMENT_ID)).toMatchObject({
      status: "accepted"
    });
    expect(snapshot.auditLogs).toEqual([
      expect.objectContaining({
        action: "assignment.eta_updated",
        actorRole: "mechanic",
        metadata: expect.objectContaining({
          assignment_id: ASSIGNMENT_ID,
          eta_at: etaAt,
          delay_reason: "Traffic delay near the rider location."
        })
      })
    ]);
    expect(snapshot.outboxEvents).toEqual([
      expect.objectContaining({
        topic: "assignment.eta_updated",
        payload: expect.objectContaining({
          assignment_id: ASSIGNMENT_ID,
          eta_at: etaAt
        })
      })
    ]);
  });

  it("supports idempotent replay and rejects same-key body conflicts", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const service = new MechanicAssignmentMetadataService(unitOfWork, { now: () => NOW });
    const etaAt = new Date(NOW.getTime() + 5 * 60_000).toISOString();

    const first = await service.updateEta(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      { eta_at: etaAt },
      "eta-key-2"
    );
    await expect(
      service.updateEta(identity(MECHANIC_ID), ASSIGNMENT_ID, { eta_at: etaAt }, "eta-key-2")
    ).resolves.toEqual(first);
    expect(unitOfWork.snapshot().assignmentEtaMetadata).toHaveLength(1);

    await expect(
      service.updateEta(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        { eta_at: new Date(NOW.getTime() + 6 * 60_000).toISOString() },
        "eta-key-2"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });

  it("rejects unowned assignments, terminal assignments, invalid ETA bounds, and bad idempotency", async () => {
    const service = new MechanicAssignmentMetadataService(createMechanicOperationsUnitOfWork(), {
      now: () => NOW
    });

    await expect(
      service.updateEta(
        identity(MECHANIC_ID),
        OTHER_ASSIGNMENT_ID,
        { eta_at: new Date(NOW.getTime() + 5 * 60_000).toISOString() },
        "eta-key-3"
      )
    ).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    await expect(
      service.updateEta(
        identity(MECHANIC_ID),
        COMPLETED_ASSIGNMENT_ID,
        { eta_at: new Date(NOW.getTime() + 5 * 60_000).toISOString() },
        "eta-key-4"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    await expect(
      service.updateEta(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        { eta_at: new Date(NOW.getTime() + 30_000).toISOString() },
        "eta-key-5"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.updateEta(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        { delay_reason: "x".repeat(501) },
        "eta-key-6"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.updateEta(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        { eta_at: new Date(NOW.getTime() + 5 * 60_000).toISOString() },
        ""
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
  });
});
