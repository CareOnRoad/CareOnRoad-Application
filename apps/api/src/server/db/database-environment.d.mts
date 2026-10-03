export type PostgresTestEnvironment = {
  NODE_ENV?: string;
  RUN_DB_TESTS?: string;
  TEST_DATABASE_URL?: string;
  DATABASE_URL?: string;
  TEST_DATABASE_CONFIRMED?: string;
};
export function databaseIdentity(value: string | undefined): string | undefined;
export function requirePostgresTestDatabaseUrl(environment: PostgresTestEnvironment): string;
