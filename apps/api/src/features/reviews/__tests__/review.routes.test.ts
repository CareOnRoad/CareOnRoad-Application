import { describe, expect, it, vi } from "vitest";

import { createReviewRebuildRouteHandlers, createReviewRouteHandlers } from "../review.route-handlers";

const IDENTITY = { subject: "11111111-1111-4111-8111-111111111111", issuer: "issuer", audience: ["authenticated"] };
const ASSIGNMENT_ID = "22222222-2222-4222-8222-222222222222";

describe("review routes", () => {
  it("forwards authenticated review body and idempotency key", async () => {
    const createReview = vi.fn(async () => ({
      id: "33333333-3333-4333-8333-333333333333",
      assignment_id: ASSIGNMENT_ID,
      request_id: "44444444-4444-4444-8444-444444444444",
      mechanic_id: "55555555-5555-4555-8555-555555555555",
      rating: 5,
      created_at: "2026-08-23T08:00:00.000Z",
      mechanic_rating: { average: 5, count: 1 }
    }));
    const handlers = createReviewRouteHandlers({ authenticate: async () => IDENTITY, service: { createReview } });
    const response = await handlers.createReview(
      new Request("http://test/review", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "review-route-1" },
        body: JSON.stringify({ rating: 5 })
      }),
      ASSIGNMENT_ID
    );
    expect(response.status).toBe(201);
    expect(createReview).toHaveBeenCalledWith(IDENTITY, ASSIGNMENT_ID, { rating: 5 }, "review-route-1");
  });

  it("maps malformed JSON and invokes protected rebuild dependency", async () => {
    const handlers = createReviewRouteHandlers({
      authenticate: async () => IDENTITY,
      service: { createReview: vi.fn() }
    });
    const invalid = await handlers.createReview(
      new Request("http://test/review", { method: "POST", body: "{" }), ASSIGNMENT_ID
    );
    expect(invalid.status).toBe(400);

    const rebuild = createReviewRebuildRouteHandlers({
      authenticateWorker: () => ({ workerId: "review-worker" }),
      createWorker: () => ({ rebuild: async () => ({ mechanics_rebuilt: 2 }) })
    });
    const response = await rebuild.rebuild(new Request("http://test/rebuild", { method: "POST" }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ mechanics_rebuilt: 2 });
  });
});
