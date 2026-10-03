import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

import { assertBackendSchema, type BackendSchemaChecks } from "../backend-schema.mjs";

const compatible: BackendSchemaChecks = {
  columns: true, constraints: true, indexes: true, triggers: true, extensions: true
};

describe("backend schema probe", () => {
  it("checks database catalogs with a bound schema parameter", async () => {
    const unsafe = vi.fn().mockResolvedValue([compatible]);
    await expect(assertBackendSchema({ unsafe } as unknown as Sql)).resolves.toBeUndefined();
    expect(unsafe).toHaveBeenCalledWith(expect.stringContaining("pg_attribute"), ["public"]);
    expect(unsafe.mock.calls[0]?.[0]).toContain("assignments_one_active_mechanic_idx");
  });

  it.each(Object.keys(compatible) as Array<keyof BackendSchemaChecks>)("rejects missing %s without including database details", async (key) => {
    const unsafe = vi.fn().mockResolvedValue([{ ...compatible, [key]: false }]);
    await expect(assertBackendSchema({ unsafe } as unknown as Sql)).rejects.toThrow("BACKEND_SCHEMA_INCOMPATIBLE");
  });
});
