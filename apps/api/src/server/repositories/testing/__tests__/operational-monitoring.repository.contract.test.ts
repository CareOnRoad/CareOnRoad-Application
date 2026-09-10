import { describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../in-memory-unit-of-work";

describe("operational monitoring repository contract", () => {
  it("appends and orders immutable-shaped worker records", async () => {
    const unit = new InMemoryUnitOfWork();
    await unit.execute(({ operationalMonitoring }) => operationalMonitoring.appendWorkerRun({ id: "00000000-0000-4000-8000-000000000001", workerName: "outbox", status: "succeeded", itemsClaimed: 1, itemsSucceeded: 1, itemsFailed: 0, startedAt: new Date("2026-01-01T00:00:00Z"), completedAt: new Date("2026-01-01T00:00:01Z") }));
    const rows = await unit.execute(({ operationalMonitoring }) => operationalMonitoring.listWorkerRuns({ limit: 10 }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ workerName: "outbox", itemsSucceeded: 1 });
  });
});
