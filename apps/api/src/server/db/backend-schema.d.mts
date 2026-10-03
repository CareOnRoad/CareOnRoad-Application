import type { Sql } from "postgres";

export const REQUIRED_BACKEND_SCHEMA_VERSION: string;
export type BackendSchemaChecks = Record<"columns" | "constraints" | "indexes" | "triggers" | "extensions", boolean>;
export function checkBackendSchema(sql: Pick<Sql, "unsafe">, schema?: string): Promise<BackendSchemaChecks>;
export function assertBackendSchema(sql: Pick<Sql, "unsafe">, schema?: string): Promise<void>;
