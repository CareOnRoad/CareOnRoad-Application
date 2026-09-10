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

describe("mechanic jobs route handlers", () => {
  it("validates filters and returns mechanic-owned jobs", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const handlers = createMechanicOperationsRouteHandlers({
      authenticate,
      dashboardService: new MechanicDashboardService(unitOfWork, { now: () => NOW }),
      jobListService: new MechanicJobListService(unitOfWork),
      performanceService: new MechanicPerformanceService(unitOfWork)
    });

    const invalid = await handlers.listJobs(
      request("/api/v1/mechanics/me/jobs?status=unknown", "mechanic")
    );
    expect(invalid.status).toBe(400);

    const ok = await handlers.listJobs(
      request("/api/v1/mechanics/me/jobs?active_only=true&limit=10", "mechanic")
    );
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({
      items: [{ assignment_id: "99999999-9999-4999-8999-999999999999" }],
      page: { limit: 10, has_more: false }
    });
  });
});
