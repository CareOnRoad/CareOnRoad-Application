import type { AiProviderName } from "@/features/chatbot/ai-provider.types";
import type { RateLimitDecision } from "@/lib/rate-limit";

export type RuntimeRateScope = NonNullable<RateLimitDecision["scope"]>;
export type RuntimeRateBucket = { count: number; resetAt: number };

export interface RuntimeControlStore {
  consumeRateBucket(input: { keyHash: string; scope: RuntimeRateScope; limit: number; windowMs: number; now: number }): Promise<RuntimeRateBucket>;
  isCircuitOpen(provider: AiProviderName, now: number): Promise<boolean>;
  recordCircuitSuccess(provider: AiProviderName): Promise<void>;
  recordCircuitFailure(input: { provider: AiProviderName; threshold: number; cooldownMs: number; now: number }): Promise<void>;
  cleanupExpired(now: number, limit: number): Promise<number>;
}
