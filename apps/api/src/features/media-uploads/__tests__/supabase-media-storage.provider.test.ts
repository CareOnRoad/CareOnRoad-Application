import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { SupabaseMediaStorageProvider } from "../supabase-media-storage.provider";

describe("SupabaseMediaStorageProvider", () => {
  it("signs a backend-owned path without returning credentials", async () => {
    let seenInit: RequestInit | undefined;
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenInit = init;
      return new Response(
        JSON.stringify({ url: "/object/upload/sign/private/a/b.jpg?token=signed-token" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const provider = createProvider(fetch);
    const result = await provider.createSignedUpload({
      bucket: "private",
      objectKey: "a/b.jpg",
      contentType: "image/jpeg"
    });
    expect(result.uploadUrl).toBe(
      "https://project.supabase.co/storage/v1/object/upload/sign/private/a/b.jpg?token=signed-token"
    );
    expect(result.requiredHeaders).toEqual({ "content-type": "image/jpeg" });
    expect((seenInit?.headers as Record<string, string>).authorization).toBe("Bearer service-secret");
    expect(JSON.stringify(result)).not.toContain("service-secret");
  });

  it("streams and hashes the actual private object", async () => {
    const bytes = new TextEncoder().encode("actual-object");
    const fetch = vi.fn(async () =>
      new Response(bytes, {
        status: 200,
        headers: { "content-type": "image/webp", "content-length": String(bytes.byteLength) }
      })
    );
    const result = await createProvider(fetch).inspectAndHash({
      bucket: "private",
      objectKey: "a/object.webp",
      maxBytes: 100
    });
    expect(result).toEqual({
      contentType: "image/webp",
      sizeBytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex")
    });
  });

  it("maps missing objects and rejects oversized streams", async () => {
    const missing = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(
      createProvider(missing).inspectAndHash({ bucket: "b", objectKey: "x", maxBytes: 1 })
    ).resolves.toBeUndefined();

    const oversized = vi.fn(async () =>
      new Response(new Uint8Array([1, 2]), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "2" }
      })
    );
    await expect(
      createProvider(oversized).inspectAndHash({ bucket: "b", objectKey: "x", maxBytes: 1 })
    ).rejects.toMatchObject({ status: 502, errorCode: "PROVIDER_ERROR" });
  });
});

function createProvider(fetch: ReturnType<typeof vi.fn>) {
  return new SupabaseMediaStorageProvider({
    supabaseUrl: "https://project.supabase.co",
    serviceRoleKey: "service-secret",
    fetch: fetch as unknown as typeof globalThis.fetch
  });
}
