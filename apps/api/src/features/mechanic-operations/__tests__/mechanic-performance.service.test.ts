import { describe, expect, it } from "vitest";

import { MechanicPerformanceService } from "../mechanic-performance.service";
import {
  createMechanicOperationsUnitOfWork,
  identity,
  MECHANIC_ID
} from "./mechanic-operations-test-fixtures";

describe("MechanicPerformanceService", () => {
  it("derives operational metrics without payment or payout fields", async () => {
    const service = new MechanicPerformanceService(createMechanicOperationsUnitOfWork());

    const performance = await service.getPerformance(identity(MECHANIC_ID), {
      date_from: "2026-07-01T00:00:00.000Z",
      date_to: "2026-07-07T23:59:59.000Z"
    });

    expect(performance).toMatchObject({
      completed_jobs: 1,
      canceled_jobs: 1,
      acceptance_rate: 0.5,
      decline_rate: 0.5,
      average_accept_time_seconds: 300,
      average_workflow_duration_seconds: 86400,
      quote_approval_rate: 0.5,
      rating: { average: 4.7, count: 19 }
    });
    expect(JSON.stringify(performance)).not.toMatch(/earning|payout|payment/i);
  });

  it("rejects invalid date ranges", async () => {
    const service = new MechanicPerformanceService(createMechanicOperationsUnitOfWork());

    await expect(
      service.getPerformance(identity(MECHANIC_ID), {
        date_from: "2026-07-08T00:00:00.000Z",
        date_to: "2026-07-07T00:00:00.000Z"
      })
    ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_INPUT" });
  });
});
