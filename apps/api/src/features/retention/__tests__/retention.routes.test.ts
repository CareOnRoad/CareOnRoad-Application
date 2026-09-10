import { describe, expect, it, vi } from "vitest";
import { createRetentionRouteHandlers } from "../retention.route-handlers";
describe("retention worker route", () => {
  it("authenticates, defaults dry-run, and forwards bounded input", async () => { const run = vi.fn(async () => ({ worker_id: "test", mode: "dry_run" as const, status: "completed" as const, classes: [] })); const handlers = createRetentionRouteHandlers({ authenticateWorker: () => ({ workerId: "test" }), createWorker: () => ({ run }) }); const response = await handlers.run(new Request("http://test", { method: "POST" })); expect(response.status).toBe(200); expect(run).toHaveBeenCalledWith({ dryRun: true, limit: 25 }); });
  it("rejects invalid broad input", async () => { const handlers = createRetentionRouteHandlers({ authenticateWorker: () => ({ workerId: "test" }), createWorker: () => ({ run: async () => ({ worker_id: "test", mode: "dry_run", status: "completed", classes: [] }) }) }); const response = await handlers.run(new Request("http://test", { method: "POST", body: JSON.stringify({ target: "all" }) })); expect(response.status).toBe(400); });
});
