import { createHash } from "node:crypto";
import type { RateLimitDecision, RateLimiter, RateLimitRequest } from "@/lib/rate-limit";
import { DAY_MS, DEFAULT_IP_DAILY_LIMIT, DEFAULT_IP_LIMIT, InMemoryRateLimiter, rateLimitDenial } from "@/lib/rate-limit";
import type { RuntimeControlStore, RuntimeRateScope } from "./runtime-control.store";

const HOUR_MS = 3_600_000;
export class SharedRateLimiter implements RateLimiter {
  constructor(private readonly store: RuntimeControlStore, private readonly options: {
    fallback?: RateLimiter; now?: () => number; timeoutMs?: number; windowMs?: number;
    sessionLimit?: number; ipLimit?: number; ipDailyLimit?: number; voiceSessionLimit?: number; transcriptionSessionLimit?: number;
  } = {}) {}

  checkDiagnosisRequest(request: RateLimitRequest) { return this.check(request, false); }
  checkTranscriptionRequest(request: RateLimitRequest) { return this.check(request, true); }

  private async check(request: RateLimitRequest, transcription: boolean): Promise<RateLimitDecision> {
    try {
      const specs: Array<{ scope: RuntimeRateScope; value: string; limit: number; windowMs?: number }> = [];
      if (request.sessionId) specs.push({ scope: transcription ? "transcription_session" : "session", value: request.sessionId, limit: transcription ? this.options.transcriptionSessionLimit ?? 30 : this.options.sessionLimit ?? 10 });
      if (request.ip) specs.push({ scope: "ip", value: request.ip, limit: this.options.ipLimit ?? DEFAULT_IP_LIMIT });
      if (request.ip && !transcription) specs.push({ scope: "ip_daily", value: request.ip, limit: this.options.ipDailyLimit ?? DEFAULT_IP_DAILY_LIMIT, windowMs: DAY_MS });
      if (!transcription && request.inputMode === "voice" && request.sessionId) specs.push({ scope: "voice_session", value: request.sessionId, limit: this.options.voiceSessionLimit ?? 5 });
      const decisions: RateLimitDecision[] = [];
      for (const spec of specs) decisions.push(await withTimeout(this.consume(spec), this.options.timeoutMs ?? 500));
      return decisions.find((item) => !item.allowed) ?? { allowed: true, remaining: lowestRemaining(decisions) };
    } catch {
      const fallback = this.options.fallback ?? new InMemoryRateLimiter();
      return await (transcription ? fallback.checkTranscriptionRequest(request) : fallback.checkDiagnosisRequest(request));
    }
  }

  private async consume(spec: { scope: RuntimeRateScope; value: string; limit: number; windowMs?: number }): Promise<RateLimitDecision> {
    const now = this.options.now?.() ?? Date.now();
    // The DB scope check predates ip_daily; the distinct key hash keeps daily buckets separate.
    const storeScope = spec.scope === "ip_daily" ? "ip" : spec.scope;
    const bucket = await this.store.consumeRateBucket({ keyHash: hashKey(spec.scope, spec.value), scope: storeScope, limit: spec.limit, windowMs: spec.windowMs ?? this.options.windowMs ?? HOUR_MS, now });
    const allowed = bucket.count <= spec.limit;
    return { allowed, ...(allowed ? {} : { ...rateLimitDenial(spec.scope), retryAfterSeconds: Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1) }), limit: spec.limit, remaining: Math.max(spec.limit - bucket.count, 0), resetAt: bucket.resetAt, scope: spec.scope };
  }
}

function hashKey(scope: RuntimeRateScope, value: string) { return createHash("sha256").update(`careonroad:runtime:${scope}:${value}`).digest("hex"); }
function lowestRemaining(items: RateLimitDecision[]) { return items.reduce<number | undefined>((lowest, item) => item.remaining === undefined ? lowest : lowest === undefined ? item.remaining : Math.min(lowest, item.remaining), undefined); }
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("RUNTIME_CONTROL_TIMEOUT")), timeoutMs); })]); }
  finally { if (timer) clearTimeout(timer); }
}
