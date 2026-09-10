import type { Sql, TransactionSql } from "postgres";

import {
  DatabaseError,
  getPostgresErrorCode,
  isRetryableDatabaseError,
  normalizeDatabaseError
} from "./database-errors";

export type TransactionOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
};

export async function runInTransaction<T>(
  sql: Pick<Sql, "begin">,
  operation: (transaction: TransactionSql) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 25;
  const sleep = options.sleep ?? defaultSleep;

  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Transaction maxAttempts must be a positive integer.");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return (await sql.begin((transaction) => operation(transaction))) as T;
    } catch (error) {
      if (!(error instanceof DatabaseError) && !getPostgresErrorCode(error)) {
        throw error;
      }
      if (!isRetryableDatabaseError(error) || attempt === maxAttempts) {
        throw normalizeDatabaseError(error);
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error("Transaction retry loop exited unexpectedly.");
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
