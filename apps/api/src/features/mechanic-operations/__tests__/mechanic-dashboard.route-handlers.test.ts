import { describe, expect, it } from "vitest";

import { MechanicDashboardService } from "../mechanic-dashboard.service";
import { createMechanicOperationsRouteHandlers } from "../mechanic-operations.route-handlers";
import {
  authenticate,
  createMechanicOperationsUnitOfWork,
  NOW,
  request
} from "./mechanic-operations-test-fixtures";

describe("mechanic dashboard route handlers", () => {
  it("enforces auth/role boundaries and returns the dashboard", async () => {
    const handlers = createMechanicOperationsRouteHandlers({
      authenticate,
      dashboardService: new MechanicDashboardService(createMechanicOperationsUnitOfWork(), {
        now: () => NOW
      }),
      jobListService: { listJobs: async () => ({ items: [], page: { limit: 50, has_more: false } }) },
      performanceService: {
        getPerformance: async () => ({
          completed_jobs: 0,
          canceled_jobs: 0,
          acceptance_rate: 0,
          decline_rate: 0,
          quote_approval_rate: 0,
          rating: { average: 0, count: 0 }
        })
      }
    });

    const missing = await handlers.getDashboard(request("/api/v1/mechanics/me/dashboard"));
    expect(missing.status).toBe(401);
    const invalid = await handlers.getDashboard(
      request("/api/v1/mechanics/me/dashboard", "invalid")
    );
    expect(invalid.status).toBe(401);
    const rider = await handlers.getDashboard(
      request("/api/v1/mechanics/me/dashboard", "rider")
    );
    expect(rider.status).toBe(403);

    const ok = await handlers.getDashboard(
      request("/api/v1/mechanics/me/dashboard", "mechanic")
    );
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({
      open_offers_count: 1,
      rating: { average: 4.7, count: 19 }
    });
  });
});
