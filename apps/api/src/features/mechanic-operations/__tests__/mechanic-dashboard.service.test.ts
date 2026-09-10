import { describe, expect, it } from "vitest";

import { MechanicDashboardService } from "../mechanic-dashboard.service";
import {
  createMechanicOperationsUnitOfWork,
  identity,
  MECHANIC_ID,
  NOW,
  RIDER_ID
} from "./mechanic-operations-test-fixtures";

describe("MechanicDashboardService", () => {
  it("composes open offers, active job, metrics, rating, and next actions", async () => {
    const service = new MechanicDashboardService(createMechanicOperationsUnitOfWork(), {
      now: () => NOW
    });

    await expect(service.getDashboard(identity(MECHANIC_ID))).resolves.toMatchObject({
      availability: { profile_status: "active", is_available: true },
      location: { freshness: "fresh", updated_at: NOW.toISOString() },
      open_offers_count: 1,
      active_assignment: {
        assignment_id: "99999999-9999-4999-8999-999999999999",
        request: { request_code: "COR-MOB-20260707-1" },
        next_action_code: "continue_active_job"
      },
      today_counts: { accepted_jobs: 1, completed_jobs: 0, canceled_jobs: 0 },
      seven_day_performance: {
        completed_jobs: 1,
        canceled_jobs: 1,
        acceptance_rate: 0.5,
        decline_rate: 0.5,
        quote_approval_rate: 0.5
      },
      rating: { average: 4.7, count: 19 },
      next_action_codes: ["review_offer", "continue_active_job"]
    });
  });

  it("surfaces stale location and rejects non-mechanic actors", async () => {
    const service = new MechanicDashboardService(
      createMechanicOperationsUnitOfWork({ staleLocation: true }),
      { now: () => NOW }
    );

    await expect(service.getDashboard(identity(MECHANIC_ID))).resolves.toMatchObject({
      location: { freshness: "stale" },
      next_action_codes: ["update_location", "review_offer", "continue_active_job"]
    });
    await expect(service.getDashboard(identity(RIDER_ID))).rejects.toMatchObject({
      status: 403,
      errorCode: "FORBIDDEN"
    });
  });
});
