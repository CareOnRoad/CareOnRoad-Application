const RETRYABLE_DATABASE_CODES = new Set(["40001", "40P01"]);

export type DatabaseErrorCode =
  | "DATABASE_CONFLICT"
  | "DATABASE_CONSTRAINT_VIOLATION"
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_ERROR";

export class DatabaseError extends Error {
  constructor(
    public readonly errorCode: DatabaseErrorCode,
    message: string,
    public readonly options: {
      cause?: unknown;
      postgresCode?: string;
      retryable?: boolean;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "DatabaseError";
  }

  get postgresCode(): string | undefined {
    return this.options.postgresCode;
  }

  get retryable(): boolean {
    return this.options.retryable ?? false;
  }
}

export function getPostgresErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}

export function isRetryableDatabaseError(error: unknown): boolean {
  const postgresCode = error instanceof DatabaseError ? error.postgresCode : getPostgresErrorCode(error);
  return Boolean(postgresCode && RETRYABLE_DATABASE_CODES.has(postgresCode));
}

export function normalizeDatabaseError(error: unknown): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  const postgresCode = getPostgresErrorCode(error);
  if (postgresCode === "23505" || postgresCode === "23P01") {
    return new DatabaseError("DATABASE_CONFLICT", "The database rejected a conflicting change.", {
      cause: error,
      postgresCode
    });
  }
  if (postgresCode?.startsWith("23")) {
    return new DatabaseError(
      "DATABASE_CONSTRAINT_VIOLATION",
      "The database rejected an invalid state change.",
      { cause: error, postgresCode }
    );
  }
  if (postgresCode?.startsWith("08") || postgresCode === "57P01") {
    return new DatabaseError("DATABASE_UNAVAILABLE", "The database is unavailable.", {
      cause: error,
      postgresCode,
      retryable: true
    });
  }
  if (postgresCode && RETRYABLE_DATABASE_CODES.has(postgresCode)) {
    return new DatabaseError("DATABASE_CONFLICT", "The transaction must be retried.", {
      cause: error,
      postgresCode,
      retryable: true
    });
  }

  return new DatabaseError("DATABASE_ERROR", "A database operation failed.", {
    cause: error,
    postgresCode
  });
}
