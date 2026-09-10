import type { AiProviderName } from "@/features/chatbot/ai-provider.types";
import type { RuntimeControlStore, RuntimeRateBucket } from "./runtime-control.store";

export class InMemoryRuntimeControlStore implements RuntimeControlStore {
  readonly buckets = new Map<string, RuntimeRateBucket>();
  readonly circuits = new Map<AiProviderName, { failures: number; openUntil?: number }>();
  async consumeRateBucket(input: Parameters<RuntimeControlStore["consumeRateBucket"]>[0]) {
    const current = this.buckets.get(input.keyHash);
    const bucket = current && current.resetAt > input.now ? { ...current, count: current.count + 1 } : { count: 1, resetAt: input.now + input.windowMs };
    this.buckets.set(input.keyHash, bucket); return bucket;
  }
  async isCircuitOpen(provider: AiProviderName, now: number) {
    const state = this.circuits.get(provider); if (!state?.openUntil) return false;
    if (state.openUntil <= now) { this.circuits.delete(provider); return false; } return true;
  }
  async recordCircuitSuccess(provider: AiProviderName) { this.circuits.delete(provider); }
  async recordCircuitFailure(input: Parameters<RuntimeControlStore["recordCircuitFailure"]>[0]) {
    const state = this.circuits.get(input.provider) ?? { failures: 0 }; const failures = state.failures + 1;
    this.circuits.set(input.provider, { failures, ...(failures >= input.threshold ? { openUntil: input.now + input.cooldownMs } : {}) });
  }
  async cleanupExpired(now: number, limit: number) { let deleted = 0; for (const [key, value] of this.buckets) { if (deleted >= Math.min(Math.max(limit, 1), 100)) break; if (value.resetAt <= now) { this.buckets.delete(key); deleted += 1; } } return deleted; }
}
