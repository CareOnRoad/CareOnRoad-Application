import { describe, expect, it } from "vitest";

import { InMemoryIdempotencyRepository } from "@/server/repositories/testing/in-memory-idempotency.repository";

import { hashIdempotencyRequest, prepareIdempotency } from "../idempotency";

describe("idempotency helpers", () => {
  it("hashes objects independently of property insertion order", () => {
    expect(hashIdempotencyRequest({ a: 1, b: 2 })).toBe(
      hashIdempotencyRequest({ b: 2, a: 1 })
    );
  });

  it("starts, replays, and rejects mismatched requests", async () => {
    const repository = new InMemoryIdempotencyRepository([]);
    const baseInput = {
      actorId: "actor-1",
      scope: "service-request.create",
      idempotencyKey: "request-key-1",
      request: { issue: "flat tire" },
      expiresAt: new Date("2026-06-26T00:00:00.000Z"),
      id: "idempotency-1"
    };

    await expect(prepareIdempotency(repository, baseInput)).resolves.toMatchObject({
      action: "execute"
    });
    await expect(prepareIdempotency(repository, baseInput)).resolves.toEqual({
      action: "in_progress"
    });

    await repository.complete({
      actorId: baseInput.actorId,
      scope: baseInput.scope,
      idempotencyKey: baseInput.idempotencyKey,
      responseStatus: 201,
      responseBody: { request_id: "request-1" },
      resourceType: "service_request",
      resourceId: "request-1"
    });

    await expect(prepareIdempotency(repository, baseInput)).resolves.toEqual({
      action: "replay",
      responseStatus: 201,
      responseBody: { request_id: "request-1" },
      resourceType: "service_request",
      resourceId: "request-1"
    });
    await expect(
      prepareIdempotency(repository, {
        ...baseInput,
        request: { issue: "different payload" }
      })
    ).resolves.toEqual({ action: "conflict" });
  });
});
