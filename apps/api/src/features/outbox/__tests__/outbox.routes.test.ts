import { describe, expect, it } from "vitest";

import { authenticateWorkerSecret } from "@/server/auth/worker-secret";

import { createOutboxRouteHandlers } from "../outbox.route-handlers";

describe("outbox worker route", () => {
  it("returns controlled 401 errors for missing, invalid, and bearer-only authority", async () => {
    const handlers = createHandlers();
    for (const request of [
      workerRequest(),
      workerRequest({ workerSecret: "invalid" }),
      workerRequest({ bearer: "valid-user-token" })
    ]) {
      const response = await handlers.runOutboxWorker(request);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error_code: "UNAUTHORIZED"
      });
    }
  });

  it("accepts valid worker authority and returns a stable batch result", async () => {
    const response = await createHandlers().runOutboxWorker(
      workerRequest({ workerSecret: "worker-secret", workerId: "outbox-route-test" })
    );
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      claimed: 2,
      processed: 2,
      retried: 0,
      deadLettered: 0
    });
  });
});

function createHandlers() {
  return createOutboxRouteHandlers({
    authenticateWorker: (request) =>
      authenticateWorkerSecret(request, { INTERNAL_WORKER_SECRET: "worker-secret" }),
    createWorker: (authority) => ({
      async processBatch() {
        expect(authority.workerId).toBe("outbox-route-test");
        return { claimed: 2, processed: 2, retried: 0, deadLettered: 0 };
      }
    })
  });
}

function workerRequest(
  options: { workerSecret?: string; workerId?: string; bearer?: string } = {}
) {
  return new Request("http://localhost/api/v1/internal/workers/outbox/run", {
    method: "POST",
    headers: {
      ...(options.workerSecret ? { "x-worker-secret": options.workerSecret } : {}),
      ...(options.workerId ? { "x-worker-id": options.workerId } : {}),
      ...(options.bearer ? { authorization: `Bearer ${options.bearer}` } : {})
    }
  });
}
