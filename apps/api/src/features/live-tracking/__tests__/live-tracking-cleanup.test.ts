import { describe, expect, it } from "vitest";

import { createLiveTrackingCleanupRouteHandlers } from "../live-tracking-cleanup.route-handlers";
import { LiveTrackingCleanupWorker } from "../live-tracking-cleanup.worker";

const now = new Date("2026-08-23T07:00:00.000Z");

describe("live tracking cleanup", () => {
  it("runs bounded idempotent count-only cleanup", async () => {
    const calls: Array<{ now: Date; limit: number }> = [];
    let remaining = 3;
    const worker = new LiveTrackingCleanupWorker({
      deleteExpired: async (inputNow, limit) => {
        calls.push({ now: inputNow, limit });
        const deleted = Math.min(remaining, limit);
        remaining -= deleted;
        return deleted;
      }
    }, { now: () => now });

    await expect(worker.run({ limit: 2 })).resolves.toEqual({ status: "completed", deleted: 2 });
    await expect(worker.run({ limit: 2 })).resolves.toEqual({ status: "completed", deleted: 1 });
    await expect(worker.run({ limit: 2 })).resolves.toEqual({ status: "completed", deleted: 0 });
    expect(calls.every((call) => call.limit === 2 && call.now.getTime() === now.getTime())).toBe(true);
    expect(JSON.stringify(await worker.run({ limit: 2 }))).not.toMatch(/latitude|longitude|location/);
  });

  it("requires worker authority and validates a 1-100 batch", async () => {
    let captured: unknown;
    const handlers = createLiveTrackingCleanupRouteHandlers({
      authenticateWorker: () => ({ workerId: "worker-1" }),
      run: async (input, authority) => {
        captured = { input, authority };
        return { status: "completed", deleted: 0 };
      }
    });
    const response = await handlers.run(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json", "x-worker-secret": "test" },
      body: JSON.stringify({ limit: 100 })
    }));
    expect(response.status).toBe(200);
    expect(captured).toEqual({ input: { limit: 100 }, authority: { workerId: "worker-1" } });

    const invalid = await handlers.run(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ limit: 101 })
    }));
    expect(invalid.status).toBe(400);
  });
});
