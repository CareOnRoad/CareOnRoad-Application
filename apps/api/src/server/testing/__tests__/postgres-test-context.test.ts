import { describe, expect, it, vi } from "vitest";

import {
  cleanupPostgresTables,
  createIsolatedPostgresTestContext,
  hasPostgresTestDatabase,
  requirePostgresTestDatabaseUrl
} from "../postgres-test-context";

describe("postgres test context", () => {
  it("blocks a shared app database even with explicit test confirmation", async () => {
    await expect(createIsolatedPostgresTestContext({ NODE_ENV: "test", RUN_DB_TESTS: "true", TEST_DATABASE_CONFIRMED: "true",
      DATABASE_URL: "postgres://postgres:app@localhost/careonroad_test",
      TEST_DATABASE_URL: "postgres://postgres:test@localhost:5432/careonroad_test" })).rejects.toThrow("separate database");
  });
  it("allows a separately confirmed hosted test project", () => {
    const environment = { NODE_ENV: "test", RUN_DB_TESTS: "true", TEST_DATABASE_CONFIRMED: "true",
      DATABASE_URL: "postgres://postgres.app:app@aws.pooler.supabase.com/postgres",
      TEST_DATABASE_URL: "postgres://postgres.test:test@aws.pooler.supabase.com/postgres" };
    expect(requirePostgresTestDatabaseUrl(environment)).toBe(environment.TEST_DATABASE_URL);
  });
  it("recognizes direct and pooler URLs for the same Supabase project", () => {
    expect(() => requirePostgresTestDatabaseUrl({ NODE_ENV: "test", RUN_DB_TESTS: "true", TEST_DATABASE_CONFIRMED: "true",
      DATABASE_URL: "postgres://postgres:app@db.same-project.supabase.co/postgres",
      TEST_DATABASE_URL: "postgres://postgres.same-project:test@aws.pooler.supabase.com/postgres" })).toThrow("separate database");
  });
  it("reports whether the dedicated test database variable is configured", () => {
    expect(hasPostgresTestDatabase({ NODE_ENV: "test", TEST_DATABASE_URL: "" })).toBe(false);
    expect(
      hasPostgresTestDatabase({
        NODE_ENV: "test",
        TEST_DATABASE_URL: "postgres://localhost/careonroad_test"
      })
    ).toBe(false);
    expect(
      hasPostgresTestDatabase({
        NODE_ENV: "test",
        RUN_DB_TESTS: "true",
        TEST_DATABASE_URL: "postgres://localhost/careonroad_test"
      })
    ).toBe(true);
  });

  it("accepts a dedicated PostgreSQL test database URL", () => {
    const databaseUrl = "postgres://postgres:postgres@localhost:54322/careonroad_test";

    expect(
      requirePostgresTestDatabaseUrl({
        NODE_ENV: "test",
        RUN_DB_TESTS: "true",
        TEST_DATABASE_URL: databaseUrl
      })
    ).toBe(databaseUrl);
  });

  it("rejects database setup unless DB tests are explicitly enabled", () => {
    expect(() =>
      requirePostgresTestDatabaseUrl({
        NODE_ENV: "test",
        TEST_DATABASE_URL: "postgres://localhost/careonroad_test"
      })
    ).toThrow("RUN_DB_TESTS=true");
  });

  it("rejects cleanup configuration outside the test environment", () => {
    expect(() =>
      requirePostgresTestDatabaseUrl({
        NODE_ENV: "development",
        RUN_DB_TESTS: "true",
        TEST_DATABASE_URL: "postgres://localhost/careonroad_test"
      })
    ).toThrow("NODE_ENV=test");
  });

  it("rejects URLs that do not clearly target a test database", () => {
    expect(() =>
      requirePostgresTestDatabaseUrl({
        NODE_ENV: "test",
        RUN_DB_TESTS: "true",
        TEST_DATABASE_URL: "postgres://localhost/careonroad"
      })
    ).toThrow("test marker");
  });

  it("rejects isolated schema setup outside the test environment before connecting", async () => {
    await expect(
      createIsolatedPostgresTestContext({
        NODE_ENV: "development",
        RUN_DB_TESTS: "true",
        TEST_DATABASE_URL: "postgres://localhost/postgres"
      })
    ).rejects.toThrow("NODE_ENV=test");
  });

  it("truncates only validated, unique table identifiers", async () => {
    const unsafe = vi.fn(async () => undefined);

    await cleanupPostgresTables(
      { unsafe },
      ["public.audit_logs", "public.outbox_events", "public.audit_logs"]
    );

    expect(unsafe).toHaveBeenCalledWith(
      'TRUNCATE TABLE "public"."audit_logs", "public"."outbox_events" RESTART IDENTITY CASCADE'
    );
  });

  it("rejects unsafe table identifiers before executing cleanup SQL", async () => {
    const unsafe = vi.fn(async () => undefined);

    await expect(cleanupPostgresTables({ unsafe }, ["audit_logs; DROP TABLE app_users"])).rejects.toThrow(
      "Unsafe PostgreSQL test table identifier"
    );
    expect(unsafe).not.toHaveBeenCalled();
  });
});
