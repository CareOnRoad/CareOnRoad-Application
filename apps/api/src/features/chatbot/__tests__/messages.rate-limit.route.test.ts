import { describe, expect, it, vi } from "vitest";

import { InMemoryRateLimiter } from "@/lib/rate-limit";

import { createMessageResponse } from "../api-routes";
import { createJsonRequest, responseJson, setupDiagnosisRoute } from "./api-route-test-helpers";

describe("POST /api/chatbot/sessions/[sessionId]/messages rate limiting", () => {
  it("returns 429 for over-limit text request by session_id", async () => {
    const { store, service, openRouter } = setupDiagnosisRoute({});
    const session = store.createSession();
    const rateLimiter = new InMemoryRateLimiter({ sessionLimit: 1, ipLimit: 99 });

    const first = await createMessageResponse(
      createJsonRequest({ input_mode: "text", content_text: "xe kho de" }),
      session.session_id,
      { diagnosis: service, rateLimiter, logger: silentLogger }
    );
    const second = await createMessageResponse(
      createJsonRequest({ input_mode: "text", content_text: "xe kho de lan hai" }),
      session.session_id,
      { diagnosis: service, rateLimiter, logger: silentLogger }
    );
    const body = await responseJson(second);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(body.error_code).toBe("AI_SESSION_LIMIT_EXCEEDED");
    expect(openRouter.createDiagnosisJson).toHaveBeenCalledTimes(1);
  });

  it("returns 429 for over-limit text request by IP fallback", async () => {
    const { store, service } = setupDiagnosisRoute({});
    const sessionA = store.createSession();
    const sessionB = store.createSession();
    const rateLimiter = new InMemoryRateLimiter({ sessionLimit: 99, ipLimit: 1 });

    const headers = { "x-forwarded-for": "203.0.113.4" };
    const first = await createMessageResponse(
      createJsonRequest({ input_mode: "text", content_text: "xe kho de" }, headers),
      sessionA.session_id,
      { diagnosis: service, rateLimiter, logger: silentLogger }
    );
    const second = await createMessageResponse(
      createJsonRequest({ input_mode: "text", content_text: "xe den yeu" }, headers),
      sessionB.session_id,
      { diagnosis: service, rateLimiter, logger: silentLogger }
    );
    const body = await responseJson(second);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(body.error_code).toBe("RATE_LIMITED");
  });

  it("logs rate limiting without full symptom text", async () => {
    const { store, service } = setupDiagnosisRoute({});
    const records: unknown[] = [];
    const logger = {
      info: vi.fn(),
      warn: vi.fn((payload) => records.push(payload)),
      error: vi.fn()
    };
    const session = store.createSession();
    const rateLimiter = new InMemoryRateLimiter({ sessionLimit: 0 });
    const fullText = "xe kho de va den yeu full symptom text";

    const response = await createMessageResponse(
      createJsonRequest({ input_mode: "text", content_text: fullText }),
      session.session_id,
      { diagnosis: service, rateLimiter, logger }
    );

    expect(response.status).toBe(429);
    expect(JSON.stringify(records)).not.toContain(fullText);
    expect(JSON.stringify(records)).not.toContain("secret-openrouter-key");
  });
});

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};
