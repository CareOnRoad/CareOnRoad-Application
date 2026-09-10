import { NextResponse } from "next/server";

import { getPostgresClient } from "@/server/db/postgres-client";

import { evaluateHealthConfiguration, readHealthTimeoutMs } from "./health-config";
import { HealthService, type ReadinessSnapshot } from "./health.service";

export type HealthRouteDependencies = {
  service: {
    liveness(): { status: "ok" };
    readiness(): Promise<ReadinessSnapshot>;
  };
};

export function createHealthRouteHandlers(dependencies: HealthRouteDependencies) {
  return {
    live() {
      return NextResponse.json(dependencies.service.liveness(), {
        status: 200,
        headers: { "cache-control": "no-store" }
      });
    },
    async ready() {
      const snapshot = await dependencies.service.readiness();
      return NextResponse.json(snapshot, {
        status: snapshot.status === "ready" ? 200 : 503,
        headers: { "cache-control": "no-store" }
      });
    }
  };
}

export function createDefaultHealthRouteHandlers() {
  return createHealthRouteHandlers({
    service: new HealthService({
      probes: [{ name: "database", run: async () => {
        const sql = getPostgresClient();
        await sql`select 1`;
      } }],
      configurationChecks: evaluateHealthConfiguration(),
      timeoutMs: readHealthTimeoutMs()
    })
  });
}
