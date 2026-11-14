import postgres, { type Sql } from "postgres";

export type PostgresEnvironment = {
  DATABASE_URL?: string;
  POSTGRES_MAX_CONNECTIONS?: string;
  POSTGRES_CONNECT_TIMEOUT_SECONDS?: string;
  POSTGRES_IDLE_TIMEOUT_SECONDS?: string;
};

export type PostgresConfig = {
  databaseUrl: string;
  maxConnections: number;
  connectTimeoutSeconds: number;
  idleTimeoutSeconds: number;
};

/**
 * Postgres client phải là SINGLETON trong toàn bộ process.
 *
 * Lý do: Next.js App Router (kể cả dev mode) biên dịch MỖI route handler thành
 * một bundle entry riêng. Vì vậy `let sharedClient` ở module scope KHÔNG được
 * chia sẻ giữa các route — mỗi route tạo một pool riêng (mặc định 10
 * connection). Với hosted Supabase (giới hạn connection thấp), nhiều pool
 * song song dẫn tới lỗi `53300 too many clients already` → mọi route trả 500
 * `DATABASE_ERROR` và mobile mất toàn bộ dữ liệu (jobs list, quotes, ...).
 *
 * Cách sửa: cache client trên `globalThis` (cùng pattern với
 * `global.__css_interop` của react-native-css-interop) để mọi bundle trong
 * cùng process dùng chung 1 pool.
 */
type PostgresGlobal = typeof globalThis & {
  __careonroadPostgresClient?: Sql;
};

const postgresGlobal = globalThis as PostgresGlobal;

export function readPostgresConfig(
  environment: PostgresEnvironment = process.env as PostgresEnvironment
): PostgresConfig {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for PostgreSQL persistence.");
  }

  return {
    databaseUrl,
    maxConnections: readPositiveInteger(environment.POSTGRES_MAX_CONNECTIONS, 10),
    connectTimeoutSeconds: readPositiveInteger(environment.POSTGRES_CONNECT_TIMEOUT_SECONDS, 10),
    idleTimeoutSeconds: readPositiveInteger(environment.POSTGRES_IDLE_TIMEOUT_SECONDS, 20)
  };
}

export function createPostgresClient(config: PostgresConfig = readPostgresConfig()): Sql {
  return postgres(config.databaseUrl, {
    max: config.maxConnections,
    connect_timeout: config.connectTimeoutSeconds,
    idle_timeout: config.idleTimeoutSeconds,
    prepare: false
  });
}

/**
 * Trả về pool Postgres dùng chung cho toàn process.
 *
 * `globalThis` đảm bảo các route handler khác nhau (mỗi route là 1 bundle
 * riêng trong Next.js) không tạo thêm pool mới.
 */
export function getPostgresClient(): Sql {
  postgresGlobal.__careonroadPostgresClient ??= createPostgresClient();
  return postgresGlobal.__careonroadPostgresClient;
}

export async function closePostgresClient(): Promise<void> {
  const client = postgresGlobal.__careonroadPostgresClient;
  if (!client) {
    return;
  }
  postgresGlobal.__careonroadPostgresClient = undefined;
  await client.end({ timeout: 5 });
}

function readPositiveInteger(rawValue: string | undefined, fallback: number): number {
  if (!rawValue?.trim()) {
    return fallback;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("PostgreSQL numeric configuration values must be positive integers.");
  }
  return parsed;
}
