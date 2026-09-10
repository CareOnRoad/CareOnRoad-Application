import type { Sql, TransactionSql } from "postgres";
import { describe, expect, it, vi } from "vitest";

import { normalizeDatabaseError } from "../database-errors";
import { readPostgresConfig } from "../postgres-client";
import { runInTransaction } from "../transaction";

describe("database foundation", () => {
  it("reads server-only PostgreSQL configuration with controlled defaults", () => {
    expect(readPostgresConfig({ DATABASE_URL: "postgres://localhost/careonroad" })).toEqual({
      databaseUrl: "postgres://localhost/careonroad",
      maxConnections: 10,
      connectTimeoutSeconds: 10,
      idleTimeoutSeconds: 20
    });
  });

  it("retries serialization failures with bounded backoff", async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => undefined);
    const begin = vi.fn(async (work: (transaction: TransactionSql) => Promise<string>) => {
      attempts += 1;
      if (attempts < 3) {
        throw Object.assign(new Error("serialization"), { code: "40001" });
      }
      return work({} as TransactionSql);
    });

    const result = await runInTransaction(
      { begin } as unknown as Pick<Sql, "begin">,
      async () => "committed",
      { maxAttempts: 3, baseDelayMs: 5, sleep }
    );

    expect(result).toBe("committed");
    expect(begin).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 5);
    expect(sleep).toHaveBeenNthCalledWith(2, 10);
  });

  it("maps PostgreSQL constraint failures to controlled database errors", () => {
    expect(normalizeDatabaseError(Object.assign(new Error("duplicate"), { code: "23505" }))).toMatchObject({
      errorCode: "DATABASE_CONFLICT",
      postgresCode: "23505",
      retryable: false
    });
  });
});
