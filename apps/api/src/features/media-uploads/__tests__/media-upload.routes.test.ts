import { describe, expect, it, vi } from "vitest";

import {
  createMediaUploadCleanupRouteHandlers,
  createMediaUploadRouteHandlers
} from "../media-upload.route-handlers";

const IDENTITY = {
  subject: "11111111-1111-4111-8111-111111111111",
  issuer: "https://test.supabase.co/auth/v1",
  audience: ["authenticated"]
};

describe("media upload routes", () => {
  it("authenticates and forwards strict create/finalize idempotency inputs", async () => {
    const createIntent = vi.fn(async () => ({
      intent_id: "22222222-2222-4222-8222-222222222222",
      resource_type: "service_request" as const,
      resource_id: "33333333-3333-4333-8333-333333333333",
      object_key: "service-requests/resource/actor/intent.jpg",
      upload_url: "https://storage.test/signed",
      upload_method: "PUT" as const,
      required_headers: { "content-type": "image/jpeg" },
      expires_at: "2026-08-23T03:10:00.000Z"
    }));
    const finalizeIntent = vi.fn(async () => ({
      intent_id: "22222222-2222-4222-8222-222222222222",
      status: "finalized" as const,
      resource_type: "service_request" as const,
      resource_id: "33333333-3333-4333-8333-333333333333",
      media: {
        id: "44444444-4444-4444-8444-444444444444",
        purpose: "problem_photo",
        content_type: "image/jpeg",
        size_bytes: 10,
        created_at: "2026-08-23T03:00:00.000Z"
      }
    }));
    const handlers = createMediaUploadRouteHandlers({
      authenticate: async () => IDENTITY,
      service: { createIntent, finalizeIntent }
    });
    const createResponse = await handlers.createIntent(
      new Request("http://test/api/v1/media/upload-intents", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "create-key-1" },
        body: JSON.stringify({ resource_type: "service_request" })
      })
    );
    expect(createResponse.status).toBe(201);
    expect(createIntent).toHaveBeenCalledWith(
      IDENTITY,
      { resource_type: "service_request" },
      "create-key-1"
    );

    const finalizeResponse = await handlers.finalizeIntent(
      new Request("http://test/finalize", {
        method: "POST",
        headers: { "x-idempotency-key": "finalize-key-1" }
      }),
      "22222222-2222-4222-8222-222222222222"
    );
    expect(finalizeResponse.status).toBe(201);
    expect(finalizeIntent).toHaveBeenCalledWith(
      IDENTITY,
      "22222222-2222-4222-8222-222222222222",
      "finalize-key-1"
    );
  });

  it("maps malformed JSON and protects cleanup with worker authority", async () => {
    const handlers = createMediaUploadRouteHandlers({
      authenticate: async () => IDENTITY,
      service: { createIntent: vi.fn(), finalizeIntent: vi.fn() }
    });
    const invalid = await handlers.createIntent(
      new Request("http://test/media", { method: "POST", body: "{" })
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error_code: "INVALID_INPUT" });

    const cleanup = createMediaUploadCleanupRouteHandlers({
      authenticateWorker: () => ({ workerId: "worker-1" }),
      createWorker: (authority) => ({
        processBatch: async () => ({ worker_id: authority.workerId, claimed: 1, expired: 1, failed: 0 })
      })
    });
    const response = await cleanup.cleanup(new Request("http://test/cleanup", { method: "POST" }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ worker_id: "worker-1", expired: 1 });
  });
});
