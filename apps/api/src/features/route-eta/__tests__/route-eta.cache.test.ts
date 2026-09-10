import { describe, expect, it, vi } from "vitest";

import { ExpiringSingleFlightCache } from "../route-eta.cache";

describe("ExpiringSingleFlightCache", () => {
  it("reuses values before expiry and reloads after expiry", async () => {
    let nowMs = 1_000;
    const cache = new ExpiringSingleFlightCache<number>({
      ttlMs: 100,
      maxEntries: 10,
      now: () => nowMs
    });
    const loader = vi.fn(async () => 42);

    expect((await cache.getOrLoad("same", loader)).value).toBe(42);
    nowMs = 1_050;
    expect((await cache.getOrLoad("same", loader)).value).toBe(42);
    nowMs = 1_101;
    expect((await cache.getOrLoad("same", loader)).value).toBe(42);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent work and removes rejected in-flight entries", async () => {
    const cache = new ExpiringSingleFlightCache<number>({ ttlMs: 100, maxEntries: 10 });
    let release!: (value: number) => void;
    const loader = vi.fn(() => new Promise<number>((resolve) => { release = resolve; }));

    const left = cache.getOrLoad("same", loader);
    const right = cache.getOrLoad("same", loader);
    release(7);
    await expect(Promise.all([left, right])).resolves.toEqual([
      expect.objectContaining({ value: 7 }),
      expect.objectContaining({ value: 7 })
    ]);
    expect(loader).toHaveBeenCalledTimes(1);

    const failure = vi.fn(async () => { throw new Error("failed"); });
    await expect(cache.getOrLoad("failure", failure)).rejects.toThrow("failed");
    await expect(cache.getOrLoad("failure", async () => 9)).resolves.toMatchObject({ value: 9 });
  });
});
