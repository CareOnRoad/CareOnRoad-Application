import { describe, expect, it } from "vitest";

import { evaluateHealthConfiguration } from "../health-config";
import { HealthService } from "../health.service";

describe("health service", () => {
  it("keeps liveness dependency-free and reports healthy readiness", async () => {
    let calls = 0;
    const service = new HealthService({
      probes: [{ name: "database", run: async () => { calls += 1; } }],
      configurationChecks: [{ name: "workers", status: "configured" }]
    });
    expect(service.liveness()).toEqual({ status: "ok" });
    expect(calls).toBe(0);
    await expect(service.readiness()).resolves.toEqual({
      status: "ready",
      checks: [
        { name: "database", status: "up" },
        { name: "workers", status: "configured" }
      ]
    });
  });

  it("bounds timeout and redacts thrown dependency details", async () => {
    const secret = "postgres://user:password@private-host/database";
    const service = new HealthService({
      probes: [
        { name: "database", run: async () => { throw new Error(secret); } },
        { name: "notifications", run: () => new Promise(() => undefined) }
      ],
      timeoutMs: 1
    });
    const result = await service.readiness();
    expect(result.status).toBe("not_ready");
    expect(result.checks).toEqual([
      { name: "database", status: "down" },
      { name: "notifications", status: "down" }
    ]);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("treats partial provider config and missing required worker config as invalid", () => {
    expect(evaluateHealthConfiguration({ FCM_PROJECT_ID: "private-project" })).toEqual(expect.arrayContaining([
      { name: "workers", status: "invalid" },
      { name: "notifications", status: "invalid" },
      { name: "media", status: "disabled" },
      { name: "payments", status: "disabled" }
    ]));
  });
});
