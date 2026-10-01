import { describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "@/server/repositories/testing/in-memory-unit-of-work";
import { recordWorkerRun } from "../worker-run-recorder";

describe("recordWorkerRun", () => {
  it("appends sanitized success and failure records", async () => {
    const unit = new InMemoryUnitOfWork();
    await expect(recordWorkerRun({ unitOfWork: unit, workerName: "dispatch", createId: () => "00000000-0000-4000-8000-000000000001", run: async () => ({ claimed: 2 }), summarize: (result) => ({ claimed: result.claimed, succeeded: 2, failed: 0 }) })).resolves.toEqual({ claimed: 2 });
    await expect(recordWorkerRun({ unitOfWork: unit, workerName: "outbox", createId: () => "00000000-0000-4000-8000-000000000002", run: async () => { throw Object.assign(new Error("secret provider details"), { errorCode: "provider timeout!" }); }, summarize: () => ({ claimed: 0, succeeded: 0, failed: 0 }) })).rejects.toThrow("secret provider details");
    await recordWorkerRun({ unitOfWork: unit, workerName: "reminders", createId: () => "00000000-0000-4000-8000-000000000003",
      run: async () => ({ failed: 1 }), summarize: (result) => ({ claimed: 2, succeeded: 1, failed: result.failed }) });
    const runs = await unit.execute(({ operationalMonitoring }) => operationalMonitoring.listWorkerRuns({ limit: 10 }));
    expect(runs).toHaveLength(3);
    expect(runs.find((run) => run.workerName === "outbox")?.errorCode).toBe("PROVIDER_TIMEOUT_");
    expect(runs.find((run) => run.workerName === "reminders")).toMatchObject({ status: "failed", itemsFailed: 1, itemsSucceeded: 1 });
    expect(JSON.stringify(runs)).not.toContain("secret provider details");
  });
});
