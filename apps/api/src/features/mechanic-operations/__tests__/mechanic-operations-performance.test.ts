import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { MechanicDashboardService } from "../mechanic-dashboard.service";
import { MechanicJobListService } from "../mechanic-job-list.service";
import { MechanicPerformanceService } from "../mechanic-performance.service";
import {
  MECHANIC_ID,
  NOW,
  createMechanicOperationsUnitOfWork,
  identity
} from "./mechanic-operations-test-fixtures";

const WARM_UP_CALLS = 5;
const MEASURED_CALLS = 20;
const MAX_DURATION_MS = 2_000;

describe("mechanic operations bounded read-model performance", () => {
  it("keeps dashboard, jobs, and performance read models under the MVP latency budget", async () => {
    const unitOfWork = createMechanicOperationsUnitOfWork();
    const actor = identity(MECHANIC_ID);
    const dashboard = new MechanicDashboardService(unitOfWork, { now: () => NOW });
    const jobs = new MechanicJobListService(unitOfWork);
    const performanceService = new MechanicPerformanceService(unitOfWork);

    await expectWithinBudget("dashboard", () => dashboard.getDashboard(actor));
    await expectWithinBudget("jobs", () => jobs.listJobs(actor, { limit: "50" }));
    await expectWithinBudget("performance", () => performanceService.getPerformance(actor, {}));
  });
});

async function expectWithinBudget(label: string, operation: () => Promise<unknown>) {
  for (let index = 0; index < WARM_UP_CALLS; index += 1) {
    await operation();
  }

  const measuredDurations: number[] = [];
  for (let index = 0; index < MEASURED_CALLS; index += 1) {
    const startedAt = performance.now();
    await operation();
    measuredDurations.push(performance.now() - startedAt);
  }

  const withinBudget = measuredDurations.filter((duration) => duration <= MAX_DURATION_MS);
  expect(
    withinBudget.length,
    `${label} durations: ${measuredDurations.map((duration) => duration.toFixed(2)).join(", ")}`
  ).toBeGreaterThanOrEqual(19);
}
