import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const roots = [
  resolve(process.cwd(), "src", "features", "admin"),
  resolve(process.cwd(), "src", "server", "repositories", "contracts"),
  resolve(process.cwd(), "src", "server", "repositories", "postgres"),
  resolve(process.cwd(), "src", "server", "repositories", "testing")
];

describe("admin feature scope", () => {
  it("does not introduce prohibited feature artifacts or unsafe generic commands", () => {
    const files = roots
      .flatMap(listProductionTypeScriptFiles)
      .filter((file) => file.toLowerCase().includes("admin"));
    const source = files
      .map((file) => `// ${relative(process.cwd(), file)}\n${readFileSync(file, "utf8")}`)
      .join("\n");

    expect(source).not.toMatch(/\bforceStatus\s*\(/);
    expect(source).not.toMatch(/\bsetRating\s*\(/);
    expect(source).not.toMatch(/\b(?:PaymentService|PaymentRepository|RefundService)\b/);
    expect(source).not.toMatch(/\b(?:GoogleRoutes|RoutingMatrix|MapsIntegration)\b/);
    expect(source).not.toMatch(/\b(?:LiveTracking|OdometerReminder)\b/);
  });

  it("adds no admin frontend or admin-owned payment artifact in Patch A", () => {
    expect(existsSync(resolve(process.cwd(), "app", "admin"))).toBe(false);
    const adminSource = roots
      .flatMap(listProductionTypeScriptFiles)
      .filter((file) => file.toLowerCase().includes("admin"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(adminSource).not.toMatch(/\b(?:PaymentService|PaymentRepository|RefundService)\b/);
  });
});

function listProductionTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : listProductionTypeScriptFiles(path);
    }
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}
