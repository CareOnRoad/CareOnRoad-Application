import { describe, expect, it } from "vitest";

import {
  createMechanicOperationsUnitOfWork,
  MECHANIC_ID,
  OTHER_ASSIGNMENT_ID
} from "@/features/mechanic-operations/__tests__/mechanic-operations-test-fixtures";

import { InMemoryMechanicOperationsRepository } from "../in-memory-mechanic-operations.repository";

describe("mechanic operations jobs repository contract", () => {
  it("paginates mechanic-owned jobs and reconciles performance aggregates", async () => {
    const snapshot = createMechanicOperationsUnitOfWork().snapshot();
    const repository = new InMemoryMechanicOperationsRepository(
      snapshot.mechanicProfiles,
      snapshot.dispatchCandidates,
      snapshot.assignments,
      snapshot.serviceRequests,
      snapshot.quotes
    );

    const first = await repository.listJobs({ mechanicId: MECHANIC_ID, limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeDefined();
    const second = await repository.listJobs({
      mechanicId: MECHANIC_ID,
      limit: 10,
      cursor: first.nextCursor
    });
    expect(second.items.map((item) => item.id)).not.toContain(first.items[0]!.id);
    expect(JSON.stringify([...first.items, ...second.items])).not.toContain(OTHER_ASSIGNMENT_ID);

    await expect(
      repository.getPerformance({ mechanicId: MECHANIC_ID })
    ).resolves.toMatchObject({
      completedJobs: 1,
      canceledJobs: 1,
      acceptedOffers: 1,
      declinedOffers: 1,
      averageAcceptTimeSeconds: 300,
      averageWorkflowDurationSeconds: 86400,
      decidedQuotes: 2,
      approvedQuotes: 1,
      ratingAvg: 4.7,
      ratingCount: 19
    });
  });
});
