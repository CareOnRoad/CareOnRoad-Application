export type CachedValue<T> = {
  value: T;
  expiresAt: Date;
};

type CacheEntry<T> = CachedValue<T> & { expiresAtMs: number };

export class ExpiringSingleFlightCache<T> {
  private readonly values = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<CachedValue<T>>>();
  private readonly now: () => number;

  constructor(private readonly options: {
    ttlMs: number;
    maxEntries: number;
    now?: () => number;
  }) {
    this.now = options.now ?? Date.now;
  }

  async getOrLoad(key: string, loader: () => Promise<T>): Promise<CachedValue<T>> {
    const nowMs = this.now();
    const existing = this.values.get(key);
    if (existing && existing.expiresAtMs > nowMs) {
      return { value: existing.value, expiresAt: new Date(existing.expiresAtMs) };
    }
    if (existing) {
      this.values.delete(key);
    }
    const pending = this.inFlight.get(key);
    if (pending) {
      return pending;
    }
    const promise = loader().then((value) => {
      const expiresAtMs = this.now() + this.options.ttlMs;
      this.prune(expiresAtMs - this.options.ttlMs);
      while (this.values.size >= this.options.maxEntries) {
        const oldest = this.values.keys().next().value as string | undefined;
        if (!oldest) break;
        this.values.delete(oldest);
      }
      this.values.set(key, { value, expiresAtMs, expiresAt: new Date(expiresAtMs) });
      return { value, expiresAt: new Date(expiresAtMs) };
    }).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  private prune(nowMs: number): void {
    for (const [key, entry] of this.values) {
      if (entry.expiresAtMs <= nowMs) {
        this.values.delete(key);
      }
    }
  }
}
