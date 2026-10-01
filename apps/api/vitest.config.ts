import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { resolve } from "node:path";
import { requirePostgresTestDatabaseUrl } from "./src/server/testing/postgres-test-context";

export default defineConfig(() => {
  const fileEnvironment = { ...loadEnv("test", resolve(process.cwd(), "../.."), ""), ...loadEnv("test", process.cwd(), "") };
  const databaseTestsRequested = isEnabled(process.env.RUN_DB_TESTS ?? fileEnvironment.RUN_DB_TESTS);
  const configuredDatabaseUrl =
    process.env.TEST_DATABASE_URL?.trim() || fileEnvironment.TEST_DATABASE_URL?.trim();

  process.env.RUN_DB_TESTS = databaseTestsRequested ? "true" : "false";
  if (databaseTestsRequested) {
    if (!configuredDatabaseUrl) {
      throw new Error("RUN_DB_TESTS=true requires TEST_DATABASE_URL.");
    }
    process.env.TEST_DATABASE_URL = configuredDatabaseUrl;
    process.env.DATABASE_URL ??= fileEnvironment.DATABASE_URL;
    process.env.TEST_DATABASE_CONFIRMED ??= fileEnvironment.TEST_DATABASE_CONFIRMED;
    requirePostgresTestDatabaseUrl({ ...process.env, NODE_ENV: "test" });
  }

  const frontendOnlyTests = [
    "src/features/chatbot/__tests__/chat-page-rendering.test.tsx"
  ];

  return {
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      exclude: databaseTestsRequested
        ? frontendOnlyTests
        : [
            ...frontendOnlyTests,
            "**/*.integration.test.ts",
            "src/features/outbox/__tests__/worker-nonblocking.smoke.test.ts"
          ],
      ...(databaseTestsRequested
        ? {
            fileParallelism: false,
            hookTimeout: 120_000,
            maxWorkers: 1,
            minWorkers: 1,
            testTimeout: 120_000
          }
        : {})
    },
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname
      }
    }
  };
});

function isEnabled(value: string | undefined): boolean {
  return /^(1|true|yes)$/i.test(value?.trim() ?? "");
}
