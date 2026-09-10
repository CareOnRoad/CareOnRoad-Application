import { describe, expect, it } from "vitest";
import { createOperationalMonitoringRouteHandlers } from "../operational-monitoring.route-handlers";

describe("operational monitoring routes", () => {
  it("authenticates and maps the selected queue", async () => {
    const handlers = createOperationalMonitoringRouteHandlers({
      authenticate: async () => ({ subject: "admin", issuer: "test", audience: [] }),
      service: { list: async (_identity, queue) => ({ items: [{ queue }], page: { limit: 25, has_more: false } }) }
    });
    const response = await handlers.list(new Request("http://test"), "dispatch-stuck");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ items: [{ queue: "dispatch-stuck" }] });
  });
});
