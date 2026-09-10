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

const validChecklistInput = {
  work_summary: "Replaced worn spark plug, checked idle, and confirmed the engine restarts reliably.",
  safety_checklist: {
    test_ride_completed: true,
    tools_removed: true,
    area_safe: true,
    rider_briefed: true,
    no_fluid_leak: true
  },
  notes: "Rider was briefed to monitor startup tomorrow."
} as const;

describe("MechanicAssignmentMetadataService completion checklist", () => {
  it("stores checklist metadata for an active owned assignment with sanitized audit and outbox", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const service = new MechanicAssignmentMetadataService(unitOfWork, { now: () => NOW });

    const response = await service.submitCompletionChecklist(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      validChecklistInput,
      "checklist-key-1"
    );

    expect(response).toMatchObject({
      assignment_id: ASSIGNMENT_ID,
      mechanic_id: MECHANIC_ID,
      revision: 1,
      work_summary: validChecklistInput.work_summary,
      safety_checklist: validChecklistInput.safety_checklist,
      notes: validChecklistInput.notes,
      created_at: NOW.toISOString()
    });
    const snapshot = unitOfWork.snapshot();
    expect(snapshot.assignmentCompletionChecklists).toHaveLength(1);
    const assignment = snapshot.assignments.find((item) => item.id === ASSIGNMENT_ID);
    expect(assignment).toMatchObject({ status: "accepted" });
    expect(assignment).not.toHaveProperty("completedAt");
    expect(assignment).not.toHaveProperty("canceledAt");
    expect(snapshot.auditLogs).toEqual([
      expect.objectContaining({
        action: "assignment.completion_checklist_submitted",
        actorRole: "mechanic",
        metadata: expect.objectContaining({
          assignment_id: ASSIGNMENT_ID,
          completion_checklist_id: response.id,
          checklist_revision: 1,
          safety_check_count: 5
        })
      })
    ]);
    expect(JSON.stringify(snapshot.auditLogs)).not.toMatch(/spark plug|test_ride_completed|monitor startup/);
    expect(snapshot.outboxEvents).toEqual([
      expect.objectContaining({
        topic: "assignment.completion_checklist_submitted",
        payload: expect.objectContaining({
          assignment_id: ASSIGNMENT_ID,
          completion_checklist_id: response.id,
          checklist_revision: 1
        })
      })
    ]);
    expect(JSON.stringify(snapshot.outboxEvents)).not.toMatch(/spark plug|test_ride_completed|monitor startup/);
  });

  it("supports idempotent replay without duplicate revisions and rejects same-key conflicts", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const service = new MechanicAssignmentMetadataService(unitOfWork, { now: () => NOW });

    const first = await service.submitCompletionChecklist(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      validChecklistInput,
      "checklist-key-2"
    );
    await expect(
      service.submitCompletionChecklist(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        validChecklistInput,
        "checklist-key-2"
      )
    ).resolves.toEqual(first);
    expect(unitOfWork.snapshot().assignmentCompletionChecklists).toHaveLength(1);

    await expect(
      service.submitCompletionChecklist(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        { ...validChecklistInput, work_summary: "Different valid summary for same idempotency key." },
        "checklist-key-2"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });

  it("rejects unowned assignments, terminal assignments, missing required fields, and bad idempotency", async () => {
    const service = new MechanicAssignmentMetadataService(createMechanicOperationsUnitOfWork(), {
      now: () => NOW
    });

    await expect(
      service.submitCompletionChecklist(
        identity(MECHANIC_ID),
        OTHER_ASSIGNMENT_ID,
        validChecklistInput,
        "checklist-key-3"
      )
    ).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    await expect(
      service.submitCompletionChecklist(
        identity(MECHANIC_ID),
        COMPLETED_ASSIGNMENT_ID,
        validChecklistInput,
        "checklist-key-4"
      )
    ).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    await expect(
      service.submitCompletionChecklist(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        { ...validChecklistInput, work_summary: "short" },
        "checklist-key-5"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.submitCompletionChecklist(
        identity(MECHANIC_ID),
        ASSIGNMENT_ID,
        {
          work_summary: validChecklistInput.work_summary,
          safety_checklist: {
            test_ride_completed: true,
            tools_removed: true,
            area_safe: true,
            rider_briefed: true
          }
        },
        "checklist-key-6"
      )
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
    await expect(
      service.submitCompletionChecklist(identity(MECHANIC_ID), ASSIGNMENT_ID, validChecklistInput, "")
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
  });
});
