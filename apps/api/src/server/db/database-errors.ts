const RETRYABLE_DATABASE_CODES = new Set(["40001", "40P01"]);

/**
 * PostgreSQL error codes nghĩa là "hết connection" / "server quá tải".
 *
 * - `53300` : too_many_connections
 * - `53400` : configuration_limit_exceeded
 * - `08000` : connection_exception
 * - `08003` : connection_does_not_exist
 * - `08006` : connection_failure
 * - `08001` : sqlclient_unable_to_establish_sqlconnection
 * - `08004` : sqlserver_rejected_establishment_of_sqlconnection
 * - `57P01` : admin_shutdown
 */
const UNAVAILABLE_DATABASE_CODES = new Set([
  "53300",
  "53400",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "57P01"
]);

/**
 * Node/undici error codes cho lỗi kết nối tới Postgres.
 *
 * Backend Next.js có thể trả 500 khi pool không kết nối được DB (LAN-only
 * deployment, mạng chập chờn, DB vừa restart). Các lỗi này nên là
 * `DATABASE_UNAVAILABLE` (503, retryable) thay vì `DATABASE_ERROR` (500).
 */
const UNAVAILABLE_CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN"
]);

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

/**
 * Dò code lỗi kết nối (Node) trong chuỗi `cause` của error.
 *
 * `postgres` (postgres.js) bọc lỗi socket/timeout vào `cause`, nên code thật
 * nằm sâu hơn 1 cấp.
 */
function findConnectionErrorCode(error: unknown, depth = 0): string | undefined {
  if (depth > 5 || !error || typeof error !== "object") {
    return undefined;
  }
  const code = getPostgresErrorCode(error);
  if (code && UNAVAILABLE_CONNECTION_CODES.has(code)) {
    return code;
  }
  if ("cause" in error) {
    return findConnectionErrorCode((error as { cause?: unknown }).cause, depth + 1);
  }
  return undefined;
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
  if (postgresCode && UNAVAILABLE_DATABASE_CODES.has(postgresCode)) {
    return new DatabaseError("DATABASE_UNAVAILABLE", "The database is unavailable.", {
      cause: error,
      postgresCode,
      retryable: true
    });
  }
  if (postgresCode?.startsWith("08")) {
    return new DatabaseError("DATABASE_UNAVAILABLE", "The database is unavailable.", {
      cause: error,
      postgresCode,
      retryable: true
    });
  }
  // Lỗi kết nối mạng tới Postgres (không có postgres code, ví dụ ECONNREFUSED
  // / ETIMEDOUT trong `cause`).
  const connectionCode = findConnectionErrorCode(error);
  if (connectionCode) {
    return new DatabaseError("DATABASE_UNAVAILABLE", "The database is unavailable.", {
      cause: error,
      postgresCode: connectionCode,
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
