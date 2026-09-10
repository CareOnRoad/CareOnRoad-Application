import { describe, expect, it } from "vitest";

import { MechanicAssignmentMetadataService } from "../mechanic-assignment-metadata.service";
import {
  ASSIGNMENT_ID,
  MECHANIC_ID,
  NOW,
  identity,
  createMechanicOperationsUnitOfWork
} from "./mechanic-operations-test-fixtures";

describe("mechanic completion checklist state regression", () => {
  it("does not complete, cancel, reassign, or append assignment status history", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const before = unitOfWork.snapshot();
    const service = new MechanicAssignmentMetadataService(unitOfWork, { now: () => NOW });

    await service.submitCompletionChecklist(
      identity(MECHANIC_ID),
      ASSIGNMENT_ID,
      {
        work_summary: "Completed the field repair and verified the motorcycle can restart safely.",
        safety_checklist: {
          test_ride_completed: true,
          tools_removed: true,
          area_safe: true,
          rider_briefed: true,
          no_fluid_leak: true
        }
      },
      "checklist-regression-1"
    );

    const after = unitOfWork.snapshot();
    expect(after.assignments).toEqual(before.assignments);
    expect(after.assignmentStatusHistory).toEqual(before.assignmentStatusHistory);
    expect(after.assignmentCompletionChecklists).toHaveLength(1);
  });
});
