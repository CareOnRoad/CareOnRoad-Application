import { describe, expect, it } from "vitest";

import { InMemoryMechanicOperationsRepository } from "../in-memory-mechanic-operations.repository";
import {
  createMechanicOperationsUnitOfWork,
  MECHANIC_ID,
  NOW
} from "@/features/mechanic-operations/__tests__/mechanic-operations-test-fixtures";

describe("mechanic operations dashboard repository contract", () => {
  it("returns bounded aggregates scoped to one mechanic", async () => {
    const snapshot = createMechanicOperationsUnitOfWork().snapshot();
    const repository = new InMemoryMechanicOperationsRepository(
      snapshot.mechanicProfiles,
      snapshot.dispatchCandidates,
      snapshot.assignments,
      snapshot.serviceRequests,
      snapshot.quotes
    );

    const dashboard = await repository.getDashboard({
      mechanicId: MECHANIC_ID,
      now: NOW,
      todayStart: new Date("2026-07-07T00:00:00.000Z"),
      sevenDaysStart: new Date("2026-06-30T08:00:00.000Z")
    });

    expect(dashboard).toMatchObject({
      openOffersCount: 1,
      activeAssignment: { id: "99999999-9999-4999-8999-999999999999" },
      today: { acceptedJobs: 1, completedJobs: 0, canceledJobs: 0 },
      sevenDays: {
        completedJobs: 1,
        canceledJobs: 1,
        acceptedOffers: 1,
        declinedOffers: 1,
        decidedQuotes: 2,
        approvedQuotes: 1
      }
    });
  });
});
