import type { AiProviderName } from "@/features/chatbot/ai-provider.types";
import type { RuntimeControlStore } from "./runtime-control.store";

export interface ProviderCircuitControl {
  isOpen(provider: AiProviderName): boolean | Promise<boolean>;
  recordSuccess(provider: AiProviderName): void | Promise<void>;
  recordFailure(provider: AiProviderName): void | Promise<void>;
}

export class InMemoryProviderCircuitBreaker implements ProviderCircuitControl {
  private readonly states = new Map<string, { failures: number; openUntil?: number }>();
  constructor(private readonly options: { now?: () => number; failureThreshold?: number; cooldownMs?: number } = {}) {}
  isOpen(provider: AiProviderName) { const state = this.states.get(provider); if (!state?.openUntil) return false; if (state.openUntil <= this.now()) { this.states.delete(provider); return false; } return true; }
  recordSuccess(provider: AiProviderName) { this.states.delete(provider); }
  recordFailure(provider: AiProviderName) { const state = this.states.get(provider) ?? { failures: 0 }; const failures = state.failures + 1; this.states.set(provider, { failures, ...(failures >= this.threshold() ? { openUntil: this.now() + this.cooldown() } : {}) }); }
  private now() { return this.options.now?.() ?? Date.now(); }
  private threshold() { return this.options.failureThreshold ?? 3; }
  private cooldown() { return this.options.cooldownMs ?? 60_000; }
}

export class SharedProviderCircuitBreaker implements ProviderCircuitControl {
  private readonly localFallback: ProviderCircuitControl;
  constructor(private readonly store: RuntimeControlStore, private readonly options: { fallback?: ProviderCircuitControl; now?: () => number; failureThreshold?: number; cooldownMs?: number; timeoutMs?: number } = {}) { this.localFallback = options.fallback ?? new InMemoryProviderCircuitBreaker(options); }
  isOpen(provider: AiProviderName) { return this.safe(() => this.store.isCircuitOpen(provider, this.now()), () => this.fallback().isOpen(provider)); }
  recordSuccess(provider: AiProviderName) { return this.safe(() => this.store.recordCircuitSuccess(provider), () => this.fallback().recordSuccess(provider)); }
  recordFailure(provider: AiProviderName) { return this.safe(() => this.store.recordCircuitFailure({ provider, threshold: this.options.failureThreshold ?? 3, cooldownMs: this.options.cooldownMs ?? 60_000, now: this.now() }), () => this.fallback().recordFailure(provider)); }
  private async safe<T>(shared: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> { try { return await timeout(shared(), this.options.timeoutMs ?? 500); } catch { return await fallback(); } }
  private fallback() { return this.localFallback; }
  private now() { return this.options.now?.() ?? Date.now(); }
}

async function timeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> { let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("RUNTIME_CONTROL_TIMEOUT")), timeoutMs); })]); } finally { if (timer) clearTimeout(timer); } }
