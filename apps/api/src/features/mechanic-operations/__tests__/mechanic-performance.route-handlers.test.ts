import { describe, expect, it } from "vitest";

import { MechanicDashboardService } from "../mechanic-dashboard.service";
import { MechanicJobListService } from "../mechanic-job-list.service";
import { createMechanicOperationsRouteHandlers } from "../mechanic-operations.route-handlers";
import { MechanicPerformanceService } from "../mechanic-performance.service";
import {
  authenticate,
  createMechanicOperationsUnitOfWork,
  NOW,
  request
} from "./mechanic-operations-test-fixtures";

describe("mechanic performance route handlers", () => {
  it("validates date ranges and returns stable performance shape", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const handlers = createMechanicOperationsRouteHandlers({
      authenticate,
      dashboardService: new MechanicDashboardService(unitOfWork, { now: () => NOW }),
      jobListService: new MechanicJobListService(unitOfWork),
      performanceService: new MechanicPerformanceService(unitOfWork)
    });

    const invalid = await handlers.getPerformance(
      request(
        "/api/v1/mechanics/me/performance?date_from=2026-07-08T00:00:00.000Z&date_to=2026-07-07T00:00:00.000Z",
        "mechanic"
      )
    );
    expect(invalid.status).toBe(400);

    const ok = await handlers.getPerformance(
      request("/api/v1/mechanics/me/performance", "mechanic")
    );
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({
      completed_jobs: 1,
      canceled_jobs: 1,
      rating: { average: 4.7, count: 19 }
    });
  });
});
