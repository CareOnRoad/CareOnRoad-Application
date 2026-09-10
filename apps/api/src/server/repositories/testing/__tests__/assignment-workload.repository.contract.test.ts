import { describe, expect, it } from "vitest";

import {
  ACTIVE_ASSIGNMENT_STATUSES,
  type Assignment,
  type AssignmentStatus
} from "../../contracts/assignment.repository";
import { InMemoryAssignmentRepository } from "../in-memory-assignment.repository";

const now = new Date("2026-06-25T05:00:00Z");

describe("in-memory assignment workload repository contract", () => {
  it("returns no workloads for an empty mechanic cohort", async () => {
    const repository = new InMemoryAssignmentRepository([], [], []);

    await expect(repository.listActiveWorkloadsByMechanicIds([])).resolves.toEqual([]);
  });

  it("counts every canonical active status and excludes terminal assignments", async () => {
    const assignments = ACTIVE_ASSIGNMENT_STATUSES.map((status, index) =>
      assignment(`active-${index}`, `mechanic-${index % 2}`, status)
    ).concat([
      assignment("completed", "terminal-only", "completed"),
      assignment("canceled", "terminal-only", "canceled")
    ]);
    const repository = new InMemoryAssignmentRepository(assignments, [], []);

    await expect(
      repository.listActiveWorkloadsByMechanicIds([
        "mechanic-0",
        "mechanic-1",
        "terminal-only",
        "unknown",
        "mechanic-0"
      ])
    ).resolves.toEqual([
      { mechanicId: "mechanic-0", activeAssignmentCount: 4 },
      { mechanicId: "mechanic-1", activeAssignmentCount: 3 }
    ]);
  });
});

function assignment(id: string, mechanicId: string, status: AssignmentStatus): Assignment {
  return {
    id,
    requestId: `request-${id}`,
    mechanicId,
    acceptedCandidateId: `candidate-${id}`,
    status,
    acceptedAt: now,
    createdAt: now,
    updatedAt: now
  };
}
