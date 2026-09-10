import { InMemoryRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { getPostgresClient } from "@/server/db/postgres-client";
import { PostgresRuntimeControlStore } from "./postgres-runtime-control.store";
import { InMemoryProviderCircuitBreaker, SharedProviderCircuitBreaker, type ProviderCircuitControl } from "./provider-circuit-breaker";
import { SharedRateLimiter } from "./shared-rate-limiter";

let rateLimiter: RateLimiter | undefined;
let circuit: ProviderCircuitControl | undefined;

export function getChatbotRateLimiter(env: NodeJS.ProcessEnv = process.env): RateLimiter {
  rateLimiter ??= createRateLimiter(env); return rateLimiter;
}
export function getProviderCircuitControl(env: NodeJS.ProcessEnv = process.env): ProviderCircuitControl {
  circuit ??= createCircuit(env); return circuit;
}
export function createRateLimiter(env: NodeJS.ProcessEnv): RateLimiter {
  const fallback = new InMemoryRateLimiter();
  return mode(env) === "postgres" ? new SharedRateLimiter(new PostgresRuntimeControlStore(getPostgresClient()), { fallback, timeoutMs: timeout(env) }) : fallback;
}
export function createCircuit(env: NodeJS.ProcessEnv): ProviderCircuitControl {
  const fallback = new InMemoryProviderCircuitBreaker();
  return mode(env) === "postgres" ? new SharedProviderCircuitBreaker(new PostgresRuntimeControlStore(getPostgresClient()), { fallback, timeoutMs: timeout(env) }) : fallback;
}
function mode(env: NodeJS.ProcessEnv) { return env.RUNTIME_CONTROLS_MODE?.trim().toLowerCase() === "postgres" ? "postgres" : "memory"; }
function timeout(env: NodeJS.ProcessEnv) { const value = Number(env.RUNTIME_CONTROLS_TIMEOUT_MS ?? "500"); return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 50), 5000) : 500; }
