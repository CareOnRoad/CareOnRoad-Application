import type { Sql } from "postgres";
import type { RuntimeControlStore, RuntimeRateBucket } from "./runtime-control.store";

export class PostgresRuntimeControlStore implements RuntimeControlStore {
  constructor(private readonly sql: Sql) {}
  async consumeRateBucket(input: Parameters<RuntimeControlStore["consumeRateBucket"]>[0]): Promise<RuntimeRateBucket> {
    const rows = await this.sql<{ request_count: number; reset_at: Date }[]>`select * from consume_runtime_rate_limit_bucket(${input.keyHash}, ${input.scope}, ${input.limit}, ${input.windowMs}, ${new Date(input.now)})`;
    return { count: rows[0].request_count, resetAt: rows[0].reset_at.getTime() };
  }
  async isCircuitOpen(provider: Parameters<RuntimeControlStore["isCircuitOpen"]>[0], now: number) {
    await this.sql`delete from provider_circuit_states where provider_name = ${provider} and open_until is not null and open_until <= ${new Date(now)}`;
    const rows = await this.sql<{ open: boolean }[]>`select coalesce(open_until > ${new Date(now)}, false) as open from provider_circuit_states where provider_name = ${provider}`;
    return rows[0]?.open ?? false;
  }
  async recordCircuitSuccess(provider: Parameters<RuntimeControlStore["recordCircuitSuccess"]>[0]) { await this.sql`delete from provider_circuit_states where provider_name = ${provider}`; }
  async recordCircuitFailure(input: Parameters<RuntimeControlStore["recordCircuitFailure"]>[0]) { await this.sql`select * from record_provider_circuit_failure(${input.provider}, ${input.threshold}, ${input.cooldownMs}, ${new Date(input.now)})`; }
  async cleanupExpired(now: number, limit: number) {
    const rows = await this.sql<{ cleanup_runtime_control_state: number }[]>`select cleanup_runtime_control_state(${new Date(now)}, ${Math.min(Math.max(limit, 1), 100)})`;
    return rows[0].cleanup_runtime_control_state;
  }
}
