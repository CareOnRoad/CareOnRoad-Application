import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type ExpectedRoute = {
  path: string;
  method: "GET" | "POST";
  handler: string;
};

const expectedRoutes: ExpectedRoute[] = [
  {
    path: "app/api/v1/mechanics/me/dashboard/route.ts",
    method: "GET",
    handler: "getDashboard"
  },
  {
    path: "app/api/v1/mechanics/me/jobs/route.ts",
    method: "GET",
    handler: "listJobs"
  },
  {
    path: "app/api/v1/mechanics/me/performance/route.ts",
    method: "GET",
    handler: "getPerformance"
  },
  {
    path: "app/api/v1/assignments/[assignmentId]/eta/route.ts",
    method: "POST",
    handler: "updateEta"
  },
  {
    path: "app/api/v1/assignments/[assignmentId]/media/route.ts",
    method: "POST",
    handler: "addMedia"
  },
  {
    path: "app/api/v1/assignments/[assignmentId]/completion-checklist/route.ts",
    method: "POST",
    handler: "submitCompletionChecklist"
  }
];

describe("mechanic operations route coverage", () => {
  it("keeps every feature endpoint backed by a thin nodejs route adapter", () => {
    for (const route of expectedRoutes) {
      const routePath = resolve(process.cwd(), route.path);
      expect(existsSync(routePath), route.path).toBe(true);

      const source = readFileSync(routePath, "utf8");
      expect(source).toContain("createDefaultMechanicOperationsRouteHandlers");
      expect(source).toContain('export const runtime = "nodejs"');
      expect(source).toContain(`export ${route.method === "POST" ? "async " : ""}function ${route.method}`);
      expect(source).toContain(`.${route.handler}(`);
      expect(source).not.toMatch(/\bNextResponse\.json\b/);
      expect(source).not.toMatch(/\bgetPostgresClient\b/);
    }
  });

  it("exposes matching handler factory methods for all public route adapters", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src",
        "features",
        "mechanic-operations",
        "mechanic-operations.route-handlers.ts"
      ),
      "utf8"
    );

    for (const route of expectedRoutes) {
      expect(source).toContain(`${route.handler}(`);
    }
    expect(source).toContain("createDefaultMechanicOperationsRouteHandlers");
    expect(source).toContain("MechanicAssignmentMetadataService");
  });
});
