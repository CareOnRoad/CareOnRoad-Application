import { describe, expect, it } from "vitest";

import { createHealthRouteHandlers } from "../health.route-handlers";

describe("health routes", () => {
  it("maps live to 200 and not-ready to 503 with no-store", async () => {
    const handlers = createHealthRouteHandlers({
      service: {
        liveness: () => ({ status: "ok" }),
        readiness: async () => ({
          status: "not_ready",
          checks: [{ name: "database", status: "down" }]
        })
      }
    });
    const live = handlers.live();
    expect(live.status).toBe(200);
    expect(live.headers.get("cache-control")).toBe("no-store");
    const ready = await handlers.ready();
    expect(ready.status).toBe(503);
    await expect(ready.json()).resolves.toEqual({
      status: "not_ready",
      checks: [{ name: "database", status: "down" }]
    });
  });
});
