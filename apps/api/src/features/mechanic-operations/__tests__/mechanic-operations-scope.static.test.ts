import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const mechanicOperationRoots = [
  resolve(process.cwd(), "src", "features", "mechanic-operations"),
  resolve(process.cwd(), "app", "api", "v1", "mechanics", "me"),
  resolve(process.cwd(), "app", "api", "v1", "assignments", "[assignmentId]")
];

const mechanicOperationMigrationNames = [
  "202606250017_assignment_eta_metadata.sql",
  "202606250018_assignment_media_metadata.sql",
  "202606250019_assignment_completion_checklists.sql"
] as const;

describe("mechanic operations scope guards", () => {
  it("does not add mechanic frontend, payment, maps, live tracking, inventory, odometer, chatbot, or ASR artifacts", () => {
    for (const forbiddenPath of [
      "app/mechanics",
      "app/mechanic",
      "src/features/inventory"
    ]) {
      expect(existsSync(resolve(process.cwd(), forbiddenPath)), forbiddenPath).toBe(false);
    }

    const source = productionFiles(mechanicOperationRoots)
      .map((file) => `// ${relative(process.cwd(), file)}\n${readFileSync(file, "utf8")}`)
      .join("\n");

    expect(source).not.toMatch(/\b(?:Payment|Checkout|Settlement|Refund|Earnings|Payout)\b/);
    expect(source).not.toMatch(/\b(?:GoogleMaps|Mapbox|MapsUI|LiveTracking|TrackingUI)\b/);
    expect(source).not.toMatch(/\b(?:Inventory|StockLevel|SparePartCommerce)\b/);
    expect(source).not.toMatch(/\b(?:Odometer|Kilometer|Mileage)\b/);
    expect(source).not.toMatch(/@\/features\/(?:chatbot|asr)\b/);
    expect(source).not.toMatch(/\b(?:Gemini|OpenRouter|sherpa-onnx|transcription)\b/i);
  });

  it("uses concrete ordered mechanic operation migration filenames covered by static migration tests", () => {
    const migrationNames = readdirSync(resolve(process.cwd(), "..", "..", "supabase", "migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    expect(
      migrationNames.filter((name) => mechanicOperationMigrationNames.includes(name as never))
    ).toEqual([...mechanicOperationMigrationNames]);

    for (const [index, name] of mechanicOperationMigrationNames.entries()) {
      expect(name).toMatch(/^20260625\d{4}_[a-z0-9_]+\.sql$/);
      if (index > 0) {
        expect(name > mechanicOperationMigrationNames[index - 1]!).toBe(true);
      }
    }

    const allMigrationsStaticTest = readFileSync(
      resolve(process.cwd(), "src", "server", "db", "__tests__", "all-migrations.static.test.ts"),
      "utf8"
    );
    for (const name of mechanicOperationMigrationNames) {
      expect(allMigrationsStaticTest).toContain(name);
    }
  });
});

function productionFiles(roots: string[]): string[] {
  return roots.flatMap((root) => listProductionFiles(root));
}

function listProductionFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : listProductionFiles(path);
    }
    if ([".ts", ".tsx", ".sql"].includes(extname(entry.name))) {
      return [path];
    }
    return [];
  });
}
