import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "@/lib/rate-limit";
import { InMemoryRuntimeControlStore } from "../in-memory-runtime-control.store";
import { InMemoryProviderCircuitBreaker, SharedProviderCircuitBreaker } from "../provider-circuit-breaker";
import { createRateLimiter } from "../runtime-control.factory";
import { SharedRateLimiter } from "../shared-rate-limiter";

describe("distributed runtime controls", () => {
  it("shares an atomic allowance and stores only opaque keys", async () => {
    const store = new InMemoryRuntimeControlStore();
    const options = { now: () => 1_000, sessionLimit: 2, ipLimit: 99 };
    const first = new SharedRateLimiter(store, options); const second = new SharedRateLimiter(store, options);
    await expect(first.checkDiagnosisRequest({ sessionId: "private-session", inputMode: "text" })).resolves.toMatchObject({ allowed: true });
    await expect(second.checkDiagnosisRequest({ sessionId: "private-session", inputMode: "text" })).resolves.toMatchObject({ allowed: true });
    await expect(first.checkDiagnosisRequest({ sessionId: "private-session", inputMode: "text" })).resolves.toMatchObject({ allowed: false, code: "AI_SESSION_LIMIT_EXCEEDED", scope: "session" });
    expect([...store.buckets.keys()].join()).not.toContain("private-session");
  });

  it("resets TTL and falls back locally on shared failure", async () => {
    let now = 0; const store = new InMemoryRuntimeControlStore();
    const limiter = new SharedRateLimiter(store, { now: () => now, windowMs: 10, sessionLimit: 1 });
    await limiter.checkDiagnosisRequest({ sessionId: "s", inputMode: "text" }); now = 11;
    await expect(limiter.checkDiagnosisRequest({ sessionId: "s", inputMode: "text" })).resolves.toMatchObject({ allowed: true });
    const failedStore = { consumeRateBucket: async () => { throw new Error("db unavailable"); }, isCircuitOpen: store.isCircuitOpen.bind(store), recordCircuitSuccess: store.recordCircuitSuccess.bind(store), recordCircuitFailure: store.recordCircuitFailure.bind(store), cleanupExpired: store.cleanupExpired.bind(store) };
    const safe = new SharedRateLimiter(failedStore, { fallback: new InMemoryRateLimiter({ sessionLimit: 0 }) });
    await expect(safe.checkDiagnosisRequest({ sessionId: "s", inputMode: "text" })).resolves.toMatchObject({ allowed: false });
  });

  it("shares circuit state and uses local circuit on failure", async () => {
    const store = new InMemoryRuntimeControlStore(); const first = new SharedProviderCircuitBreaker(store, { failureThreshold: 2 }); const second = new SharedProviderCircuitBreaker(store, { failureThreshold: 2 });
    await first.recordFailure("gemini"); await second.recordFailure("gemini");
    await expect(first.isOpen("gemini")).resolves.toBe(true);
    const fallback = new InMemoryProviderCircuitBreaker({ failureThreshold: 1 });
    const failedStore = { consumeRateBucket: store.consumeRateBucket.bind(store), isCircuitOpen: async () => { throw new Error("down"); }, recordCircuitSuccess: store.recordCircuitSuccess.bind(store), recordCircuitFailure: async () => { throw new Error("down"); }, cleanupExpired: store.cleanupExpired.bind(store) };
    const failed = new SharedProviderCircuitBreaker(failedStore, { fallback });
    await failed.recordFailure("openrouter"); await expect(failed.isOpen("openrouter")).resolves.toBe(true);
  });

  it("keeps memory as default factory mode", () => { expect(createRateLimiter({ NODE_ENV: "test" })).toBeInstanceOf(InMemoryRateLimiter); });
});
