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
      .filter(isAdminScopedFile);
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
      .filter(isAdminScopedFile)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(adminSource).not.toMatch(/\b(?:PaymentService|PaymentRepository|RefundService)\b/);
  });
});

/**
 * Chỉ match file thuộc phạm vi admin.
 *
 * ⚠️ Không được match trên absolute path: trên Windows, đường dẫn chứa
 * `C:\Users\Admin\...` sẽ khớp "admin" cho **mọi** file, khiến test kiểm tra
 * nhầm các file không liên quan (false positive) và fail tuỳ tên user máy.
 * Vì vậy ta so khớp trên đường dẫn tương đối so với `process.cwd()`.
 */
function isAdminScopedFile(file: string): boolean {
  return relative(process.cwd(), file).toLowerCase().includes("admin");
}

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
