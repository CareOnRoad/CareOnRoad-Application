import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["audit/role-flows.test.ts"] },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } }
});
