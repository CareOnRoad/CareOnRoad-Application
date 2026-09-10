import { describe, expect, it, vi } from "vitest";

import { GoogleRoutesProvider } from "../google-routes.provider";
import { RouteEtaProviderError } from "../route-eta.provider";

const input = {
  origin: { latitude: 10.775, longitude: 106.7 },
  destination: { latitude: 10.78, longitude: 106.69 }
};

describe("GoogleRoutesProvider", () => {
  it("requests a two-wheeler route with a narrow field mask", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ routes: [{ distanceMeters: 2400, duration: "420.5s" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const provider = new GoogleRoutesProvider({
      apiKey: "server-secret",
      baseUrl: "https://routes.example.test",
      timeoutMs: 1000,
      fetchFn
    });

    await expect(provider.compute(input)).resolves.toEqual({
      distanceMeters: 2400,
      durationSeconds: 421
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, request] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://routes.example.test/directions/v2:computeRoutes");
    expect(request?.headers).toMatchObject({
      "X-Goog-Api-Key": "server-secret",
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration"
    });
    expect(JSON.parse(String(request?.body))).toMatchObject({ travelMode: "TWO_WHEELER" });
  });

  it.each([
    [401, "provider_auth"],
    [403, "provider_auth"],
    [429, "provider_quota"],
    [500, "provider_error"]
  ] as const)("maps HTTP %s to %s without exposing the body", async (status, reason) => {
    const provider = new GoogleRoutesProvider({
      apiKey: "server-secret",
      baseUrl: "https://routes.example.test",
      timeoutMs: 1000,
      fetchFn: async () => new Response("raw-sensitive-provider-body", { status })
    });
    const error = await provider.compute(input).catch((caught) => caught);
    expect(error).toBeInstanceOf(RouteEtaProviderError);
    expect(error).toMatchObject({ reason });
    expect(String(error)).not.toContain("raw-sensitive-provider-body");
    expect(String(error)).not.toContain("server-secret");
  });

  it("classifies timeout and malformed results", async () => {
    const timeoutProvider = new GoogleRoutesProvider({
      apiKey: "server-secret",
      baseUrl: "https://routes.example.test",
      timeoutMs: 10,
      fetchFn: async (_url, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })
    });
    await expect(timeoutProvider.compute(input)).rejects.toMatchObject({ reason: "provider_timeout" });

    const malformedProvider = new GoogleRoutesProvider({
      apiKey: "server-secret",
      baseUrl: "https://routes.example.test",
      timeoutMs: 1000,
      fetchFn: async () => new Response(JSON.stringify({ routes: [{ distanceMeters: -1 }] }))
    });
    await expect(malformedProvider.compute(input)).rejects.toMatchObject({
      reason: "provider_invalid_response"
    });
  });
});
