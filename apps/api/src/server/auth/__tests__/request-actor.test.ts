import { afterEach, describe, expect, it, vi } from "vitest";

const { createRemoteJWKSet } = vi.hoisted(() => ({ createRemoteJWKSet: vi.fn(() => vi.fn()) }));
vi.mock("jose", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jose")>()),
  createRemoteJWKSet
}));

import { authenticateSupabaseRequest } from "../request-actor";

describe("authenticateSupabaseRequest", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reuses one remote JWKS resolver across requests so keys are not refetched each call", async () => {
    vi.stubEnv("SUPABASE_JWT_ISSUER", "https://careonroad.supabase.co/auth/v1");
    vi.stubEnv("SUPABASE_JWT_AUDIENCE", "authenticated");
    vi.stubEnv("SUPABASE_JWKS_URL", "https://careonroad.supabase.co/auth/v1/.well-known/jwks.json");
    const request = () => new Request("http://localhost/api/v1/auth/me", {
      headers: { authorization: "Bearer not-a-jwt" }
    });

    await expect(authenticateSupabaseRequest(request())).rejects.toMatchObject({ status: 401 });
    await expect(authenticateSupabaseRequest(request())).rejects.toMatchObject({ status: 401 });

    expect(createRemoteJWKSet).toHaveBeenCalledTimes(1);
  });
});
