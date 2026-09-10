import { describe, expect, it } from "vitest";

import { authenticateWorkerSecret } from "@/server/auth/worker-secret";

import { createDispatchWorkerRouteHandlers } from "../dispatch-worker.route-handlers";

const result = { claimed: 2, advanced: 1, escalated: 1, skipped: 0, failed: 0 };

describe("dispatch worker route", () => {
  it("rejects missing or invalid worker authority", async () => {
    const handlers = createHandlers();

    const response = await handlers.runDispatchWorker(
      new Request("http://localhost/api/v1/internal/workers/dispatch/run", {
        method: "POST"
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error_code: "UNAUTHORIZED" });
  });

  it("returns aggregate counters with 202 for a valid secret", async () => {
    const handlers = createHandlers();
    const response = await handlers.runDispatchWorker(
      new Request("http://localhost/api/v1/internal/workers/dispatch/run", {
        method: "POST",
        headers: {
          "x-worker-secret": "secret",
          "x-worker-id": "dispatch-cron"
        }
      })
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual(result);
  });
});

function createHandlers() {
  return createDispatchWorkerRouteHandlers({
    authenticateWorker: (request) =>
      authenticateWorkerSecret(request, { INTERNAL_WORKER_SECRET: "secret" }),
    createWorker: () => ({ processBatch: async () => result })
  });
}
