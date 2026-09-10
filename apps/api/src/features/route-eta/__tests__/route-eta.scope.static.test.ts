import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const featureSource = [
  "route-eta.types.ts",
  "route-eta.provider.ts",
  "google-routes.provider.ts",
  "route-eta.cache.ts",
  "route-eta.service.ts",
  "route-eta.route-handlers.ts"
].map((file) => readFileSync(resolve(process.cwd(), "src/features/route-eta", file), "utf8")).join("\n");

describe("route ETA static scope", () => {
  it("keeps provider secrets backend-only and avoids raw provider/location logging", () => {
    const environment = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    expect(environment).toContain("GOOGLE_ROUTES_API_KEY=");
    expect(environment).not.toContain("NEXT_PUBLIC_GOOGLE_ROUTES");
    expect(featureSource).not.toMatch(/console\.(?:log|info|warn|error)/);
    expect(featureSource).not.toMatch(/audit\.append|outbox\.append/);
  });

  it("does not mutate assignment/request workflow or add forbidden route detail scope", () => {
    const service = readFileSync(
      resolve(process.cwd(), "src/features/route-eta/route-eta.service.ts"),
      "utf8"
    );
    expect(service).not.toMatch(/updateStatus|appendStatusHistory/);
    expect(featureSource).not.toMatch(/polyline|turn.by.turn|geocod|WebSocket|EventSource/);
  });

  it("registers only the thin authenticated GET route", () => {
    const route = readFileSync(
      resolve(process.cwd(), "app/api/v1/assignments/[assignmentId]/route-eta/route.ts"),
      "utf8"
    );
    expect(route).toContain("export async function GET");
    expect(route).toContain("createDefaultRouteEtaRouteHandlers");
    expect(route).not.toMatch(/GOOGLE_ROUTES_API_KEY|fetch\(/);
  });
});
