import { describe, expect, it } from "vitest";

import { AssignmentService } from "@/features/assignments/assignment.service";

import { MechanicAssignmentMetadataService } from "../mechanic-assignment-metadata.service";
import {
  ASSIGNMENT_ID,
  MECHANIC_ID,
  NOW,
  identity,
  createMechanicOperationsUnitOfWork
} from "./mechanic-operations-test-fixtures";

describe("mechanic ETA regressions", () => {
  it("does not change assignment workflow state or dispatch candidate state", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const etaService = new MechanicAssignmentMetadataService(unitOfWork, { now: () => NOW });

    await etaService.updateEta(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      { eta_at: new Date(NOW.getTime() + 5 * 60_000).toISOString() },
      "eta-regression-key"
    );

    const afterEta = unitOfWork.snapshot();
    expect(afterEta.assignments.find((assignment) => assignment.id === ASSIGNMENT_ID)).toMatchObject({
      status: "accepted"
    });
    expect(afterEta.assignmentStatusHistory).toHaveLength(0);
    expect(afterEta.dispatchCandidates.map((candidate) => candidate.status)).toEqual([
      "offered",
      "accepted",
      "rejected",
      "offered"
    ]);

    const assignmentService = new AssignmentService(unitOfWork, { now: () => NOW });
    await expect(
      assignmentService.transitionAssignment(identity(MECHANIC_ID), ASSIGNMENT_ID, {
        status: "en_route"
      })
    ).resolves.toMatchObject({ status: "en_route" });
  });
});
