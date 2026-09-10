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

let sharedClient: Sql | undefined;

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

export function getPostgresClient(): Sql {
  sharedClient ??= createPostgresClient();
  return sharedClient;
}

export async function closePostgresClient(): Promise<void> {
  if (!sharedClient) {
    return;
  }
  const client = sharedClient;
  sharedClient = undefined;
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
