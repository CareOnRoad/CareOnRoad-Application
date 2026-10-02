import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

import { getPostgresClient } from "@/server/db/postgres-client";
import { createDefaultHealthRouteHandlers, createHealthRouteHandlers } from "../health.route-handlers";

vi.mock("@/server/db/postgres-client", () => ({ getPostgresClient: vi.fn() }));

describe("health routes", () => {
  it("returns 503 for schema 034 even when the database connection works", async () => {
    const unsafe = vi.fn().mockResolvedValue([{ columns: false, constraints: false, indexes: false, triggers: false, extensions: true }]);
    vi.mocked(getPostgresClient).mockReturnValue({ unsafe } as unknown as Sql);
    const response = await createDefaultHealthRouteHandlers().ready();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.checks).toContainEqual({ name: "database", status: "down" });
    expect(JSON.stringify(body)).not.toContain("BACKEND_SCHEMA_INCOMPATIBLE");
    expect(unsafe).toHaveBeenCalledWith(expect.stringContaining("pg_attribute"), ["public"]);
  });

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
