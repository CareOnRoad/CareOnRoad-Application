import { describe, expect, it } from "vitest";

import { MechanicDashboardService } from "../mechanic-dashboard.service";
import { MechanicJobListService } from "../mechanic-job-list.service";
import { createMechanicOperationsRouteHandlers } from "../mechanic-operations.route-handlers";
import { MechanicPerformanceService } from "../mechanic-performance.service";
import {
  authenticate,
  createMechanicOperationsUnitOfWork,
  NOW,
  ASSIGNMENT_ID,
  OTHER_ASSIGNMENT_ID,
  request
} from "./mechanic-operations-test-fixtures";

describe("mechanic jobs route handlers", () => {
  it("protects job detail and returns no-store owned content", async () => {
    const uow = createMechanicOperationsUnitOfWork();
    const handlers = createMechanicOperationsRouteHandlers({ authenticate,
      dashboardService: new MechanicDashboardService(uow), jobListService: new MechanicJobListService(uow),
      performanceService: new MechanicPerformanceService(uow) });
    const path = `/api/v1/mechanics/me/jobs/${ASSIGNMENT_ID}`;
    expect((await handlers.getJob(request(path), ASSIGNMENT_ID)).status).toBe(401);
    expect((await handlers.getJob(request(path, "invalid"), ASSIGNMENT_ID)).status).toBe(401);
    expect((await handlers.getJob(request(path, "rider"), ASSIGNMENT_ID)).status).toBe(403);
    expect((await handlers.getJob(request(path, "mechanic"), OTHER_ASSIGNMENT_ID)).status).toBe(403);
    expect((await handlers.getJob(request(path, "mechanic"), "invalid")).status).toBe(400);
    const ok = await handlers.getJob(request(path, "mechanic"), ASSIGNMENT_ID);
    expect(ok.status).toBe(200); expect(ok.headers.get("cache-control")).toBe("private, no-store");
    expect(await ok.json()).toMatchObject({ assignment: { id: ASSIGNMENT_ID }, request: { problem_description: expect.any(String) } });
  });
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
